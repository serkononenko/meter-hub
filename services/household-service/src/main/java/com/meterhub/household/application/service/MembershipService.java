package com.meterhub.household.application.service;

import com.meterhub.household.domain.exception.ForbiddenRoleException;
import com.meterhub.household.domain.exception.HouseholdAccessDeniedException;
import com.meterhub.household.domain.exception.InviteAlreadyUsedException;
import com.meterhub.household.domain.exception.InviteExpiredException;
import com.meterhub.household.domain.exception.InviteLimitReachedException;
import com.meterhub.household.domain.exception.InviteNotFoundException;
import com.meterhub.household.domain.exception.MemberNotFoundException;
import com.meterhub.household.domain.exception.OwnerCannotBeRemovedException;
import com.meterhub.household.domain.model.Household;
import com.meterhub.household.domain.model.HouseholdInvite;
import com.meterhub.household.domain.model.HouseholdInvite.InviteRole;
import com.meterhub.household.domain.model.HouseholdMember;
import com.meterhub.household.domain.model.MembershipRole;
import com.meterhub.household.ports.inbound.CreateHouseholdInviteUseCase;
import com.meterhub.household.ports.inbound.ListHouseholdInvitesUseCase;
import com.meterhub.household.ports.inbound.ListHouseholdMembersUseCase;
import com.meterhub.household.ports.inbound.RedeemHouseholdInviteUseCase;
import com.meterhub.household.ports.inbound.RemoveHouseholdMemberUseCase;
import com.meterhub.household.ports.inbound.RevokeHouseholdInviteUseCase;
import com.meterhub.household.ports.outbound.HouseholdInviteRepository;
import com.meterhub.household.ports.outbound.HouseholdMemberRepository;
import com.meterhub.household.ports.outbound.HouseholdRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

/**
 * Member and invite management. Owner-only surfaces resolve the requester's
 * membership first; non-members get {@link HouseholdAccessDeniedException},
 * members without OWNER get {@link ForbiddenRoleException}.
 */
@Service
public class MembershipService
    implements ListHouseholdMembersUseCase, RemoveHouseholdMemberUseCase,
    CreateHouseholdInviteUseCase, ListHouseholdInvitesUseCase,
    RevokeHouseholdInviteUseCase, RedeemHouseholdInviteUseCase {

    /** Bound on live invites per household, prevents code-list spam (spec section 4). */
    static final int MAX_LIVE_INVITES = 10;
    static final int DEFAULT_INVITE_TTL_DAYS = 7;
    private static final int CODE_BYTES = 24;

    private static final SecureRandom RANDOM = new SecureRandom();

    private final HouseholdRepository householdRepository;
    private final HouseholdMemberRepository householdMemberRepository;
    private final HouseholdInviteRepository householdInviteRepository;

    public MembershipService(
        HouseholdRepository householdRepository,
        HouseholdMemberRepository householdMemberRepository,
        HouseholdInviteRepository householdInviteRepository
    ) {
        this.householdRepository = householdRepository;
        this.householdMemberRepository = householdMemberRepository;
        this.householdInviteRepository = householdInviteRepository;
    }

    // --- members ---

    @Override
    @Transactional(readOnly = true)
    public List<HouseholdMember> listMembers(UUID requesterId, UUID householdId) {
        requireMembership(requesterId, householdId);
        return householdMemberRepository.findAllByHouseholdId(householdId);
    }

    @Override
    @Transactional
    public void removeMember(UUID requesterId, UUID householdId, UUID targetUserId) {
        requireRole(requesterId, householdId, MembershipRole.OWNER);

        HouseholdMember target = householdMemberRepository
            .findByHouseholdIdAndUserId(householdId, targetUserId)
            .orElseThrow(MemberNotFoundException::new);

        if (target.role() == MembershipRole.OWNER) {
            throw new OwnerCannotBeRemovedException();
        }
        householdMemberRepository.delete(target);
    }

    // --- invites ---

    @Override
    @Transactional
    public CreatedInvite createInvite(UUID requesterId, UUID householdId, InviteRole role, int expiresInDays) {
        requireRole(requesterId, householdId, MembershipRole.OWNER);

        if (householdInviteRepository.countLiveByHouseholdId(householdId) >= MAX_LIVE_INVITES) {
            throw new InviteLimitReachedException();
        }

        String code = generateCode();
        OffsetDateTime now = OffsetDateTime.now();
        HouseholdInvite invite = HouseholdInvite.builder()
            .id(UUID.randomUUID())
            .householdId(householdId)
            .role(role)
            .codeHash(hash(code))
            .createdBy(requesterId)
            .expiresAt(now.plusDays(expiresInDays))
            .createdAt(now)
            .build();
        householdInviteRepository.save(invite);
        return new CreatedInvite(invite, code);
    }

    @Override
    @Transactional(readOnly = true)
    public List<HouseholdInvite> listInvites(UUID requesterId, UUID householdId) {
        requireRole(requesterId, householdId, MembershipRole.OWNER);
        // Live-only listing is a projection concern; filtering here keeps the
        // repository generic and the liveness rule in one place.
        OffsetDateTime now = OffsetDateTime.now();
        return householdInviteRepository.findAllLiveByHouseholdId(householdId, now);
    }

    @Override
    @Transactional
    public void revokeInvite(UUID requesterId, UUID householdId, UUID inviteId) {
        requireRole(requesterId, householdId, MembershipRole.OWNER);

        HouseholdInvite invite = householdInviteRepository.findById(inviteId)
            .filter(i -> i.householdId().equals(householdId))
            .filter(i -> i.isLive(OffsetDateTime.now()))
            .orElseThrow(InviteNotFoundException::new);

        householdInviteRepository.update(invite.toBuilder()
            .revokedAt(OffsetDateTime.now())
            .build());
    }

    // --- redeem ---

    @Override
    @Transactional
    public RedeemedInvite redeem(UUID redeemerId, String code) {
        if (code == null || code.isBlank()) {
            throw new InviteNotFoundException();
        }

        HouseholdInvite invite = householdInviteRepository.findByCodeHash(hash(code))
            .orElseThrow(InviteNotFoundException::new);

        OffsetDateTime now = OffsetDateTime.now();
        // Idempotent for an existing member: the invite was theirs, return
        // the household unchanged instead of erroring (spec section 5).
        if (!invite.isLive(now)) {
            boolean wasRedeemedByCaller = redeemerId.equals(invite.redeemedBy());
            if (wasRedeemedByCaller) {
                Household household = householdRepository.findById(invite.householdId())
                    .orElseThrow(InviteNotFoundException::new);
                return new RedeemedInvite(household.id(), household.name(), invite.role().toMembershipRole());
            }
            if (invite.redeemedAt() != null) {
                throw new InviteAlreadyUsedException();
            }
            if (invite.revokedAt() != null) {
                throw new InviteNotFoundException();
            }
            throw new InviteExpiredException();
        }

        // Existing member redeeming someone else's still-live invite is also
        // a no-op success — they already have (at least) this role.
        MembershipRole granted = invite.role().toMembershipRole();
        HouseholdMember existing = householdMemberRepository
            .findByHouseholdIdAndUserId(invite.householdId(), redeemerId)
            .orElse(null);

        if (existing == null) {
            householdMemberRepository.save(HouseholdMember.builder()
                .id(UUID.randomUUID())
                .householdId(invite.householdId())
                .userId(redeemerId)
                .role(granted)
                .createdAt(now)
                .build());
        } else {
            granted = existing.role();
        }

        householdInviteRepository.update(invite.toBuilder()
            .redeemedAt(now)
            .redeemedBy(redeemerId)
            .build());

        Household household = householdRepository.findById(invite.householdId())
            .orElseThrow(InviteNotFoundException::new);
        return new RedeemedInvite(household.id(), household.name(), granted);
    }

    // --- helpers ---

    private HouseholdMember requireMembership(UUID requesterId, UUID householdId) {
        return householdMemberRepository.findByHouseholdIdAndUserId(householdId, requesterId)
            .orElseThrow(HouseholdAccessDeniedException::new);
    }

    private void requireRole(UUID requesterId, UUID householdId, MembershipRole required) {
        HouseholdMember member = requireMembership(requesterId, householdId);
        if (!member.role().satisfies(required)) {
            throw new ForbiddenRoleException();
        }
    }

    private String generateCode() {
        byte[] bytes = new byte[CODE_BYTES];
        RANDOM.nextBytes(bytes);
        return "mh_" + HexFormat.of().formatHex(bytes);
    }

    private String hash(String rawCode) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(rawCode.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }
}
