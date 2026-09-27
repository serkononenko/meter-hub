package com.meterhub.identity.adapters.inbound.web;

import com.meterhub.identity.adapters.inbound.web.api.InternalApi;
import com.meterhub.identity.adapters.inbound.web.dto.RevocationBatchDto;
import com.meterhub.identity.domain.model.RevokedAccessToken;
import com.meterhub.identity.ports.outbound.RevokedAccessTokenRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@RestController
public class InternalController implements InternalApi {

    static final int FEED_PAGE_SIZE = 1000;

    private final RevokedAccessTokenRepository revokedAccessTokens;

    public InternalController(RevokedAccessTokenRepository revokedAccessTokens) {
        this.revokedAccessTokens = revokedAccessTokens;
    }

    @Override
    public ResponseEntity<RevocationBatchDto> listRevokedAccessTokens(OffsetDateTime since, UUID xCorrelationID) {
        List<RevokedAccessToken> batch = revokedAccessTokens.findAfter(since, FEED_PAGE_SIZE);

        OffsetDateTime next = batch.isEmpty()
            ? since
            : batch.getLast().revokedAt();

        return ResponseEntity.ok(
            new RevocationBatchDto(
                batch.stream().map(RevokedAccessToken::jti).toList(),
                next
            )
        );
    }
}
