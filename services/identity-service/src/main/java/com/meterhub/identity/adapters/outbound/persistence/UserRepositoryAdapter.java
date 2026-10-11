package com.meterhub.identity.adapters.outbound.persistence;

import com.meterhub.identity.domain.model.AccountStatus;
import com.meterhub.identity.domain.model.SystemRole;
import com.meterhub.identity.domain.model.User;
import com.meterhub.identity.jooq.Tables;
import com.meterhub.identity.jooq.tables.records.UsersRecord;
import com.meterhub.identity.ports.outbound.UserRepository;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Repository
public class UserRepositoryAdapter implements UserRepository {
    private final DSLContext dsl;

    public UserRepositoryAdapter(DSLContext dsl) {
        this.dsl = dsl;
    }

    @Override
    public User save(User user) {
        dsl.insertInto(Tables.USERS)
            .set(convert(user))
            .execute();
        return user;
    }

    @Override
    public Optional<User> findById(UUID id) {
        return dsl.selectFrom(Tables.USERS)
            .where(Tables.USERS.ID.eq(id))
            .fetchOptional(this::convert);
    }

    @Override
    public Optional<User> findByEmail(String email) {
        return dsl.selectFrom(Tables.USERS)
            .where(Tables.USERS.EMAIL.equalIgnoreCase(email))
            .fetchOptional(this::convert);
    }

    @Override
    public Optional<User> findByUsername(String username) {
        return dsl.selectFrom(Tables.USERS)
            .where(Tables.USERS.USERNAME.equalIgnoreCase(username))
            .fetchOptional(this::convert);
    }

    @Override
    public Set<UUID> findIdsByRole(SystemRole role) {
        return Set.copyOf(dsl.select(Tables.USERS.ID)
            .from(Tables.USERS)
            .where(Tables.USERS.ROLE.eq(role.name()))
            .fetch(Tables.USERS.ID));
    }

    @Override
    public boolean updateRole(UUID userId, SystemRole role) {
        return dsl.update(Tables.USERS)
            .set(Tables.USERS.ROLE, role.name())
            .set(Tables.USERS.UPDATED_AT, OffsetDateTime.now())
            .where(Tables.USERS.ID.eq(userId))
            .execute() > 0;
    }

    private UsersRecord convert(User user) {
        UsersRecord record = new UsersRecord();
        record.setId(user.id());
        record.setEmail(user.email());
        record.setUsername(user.username());
        record.setPasswordHash(user.passwordHash());
        record.setStatus(user.status().name());
        record.setRole(user.role().name());
        record.setCreatedAt(user.createdAt());
        record.setUpdatedAt(user.updatedAt());
        return record;
    }

    private User convert(UsersRecord record) {
        return User.builder()
            .id(record.getId())
            .email(record.getEmail())
            .username(record.getUsername())
            .passwordHash(record.getPasswordHash())
            .status(AccountStatus.valueOf(record.getStatus()))
            .role(SystemRole.valueOf(record.getRole()))
            .createdAt(record.getCreatedAt())
            .updatedAt(record.getUpdatedAt())
            .build();
    }
}
