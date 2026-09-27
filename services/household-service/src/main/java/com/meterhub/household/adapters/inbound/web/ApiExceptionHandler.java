package com.meterhub.household.adapters.inbound.web;

import com.meterhub.household.adapters.inbound.web.dto.ProblemDto;
import com.meterhub.household.adapters.inbound.web.dto.ProblemErrorsInnerDto;
import com.meterhub.household.domain.exception.ForbiddenRoleException;
import com.meterhub.household.domain.exception.HouseholdAccessDeniedException;
import com.meterhub.household.domain.exception.HouseholdNotFoundException;
import com.meterhub.household.domain.exception.InviteAlreadyUsedException;
import com.meterhub.household.domain.exception.InviteExpiredException;
import com.meterhub.household.domain.exception.InviteLimitReachedException;
import com.meterhub.household.domain.exception.InviteNotFoundException;
import com.meterhub.household.domain.exception.MemberNotFoundException;
import com.meterhub.household.domain.exception.OwnerCannotBeRemovedException;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.List;
import java.util.UUID;

/**
 * RFC 9457 problem+json responses for MeterHub API errors.
 *
 * <p>Bodies never include stack traces, SQL details, or internal
 * infrastructure information; the full exception is logged server-side only
 * (api-conventions.md §5).
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);
    private static final String PROBLEM_BASE_URI = "https://api.meterhub.local/problems/";

    @ExceptionHandler(HouseholdNotFoundException.class)
    public ResponseEntity<ProblemDto> handleHouseholdNotFound(HouseholdNotFoundException e, HttpServletRequest request) {
        log.info("Household lookup rejected: {}", e.getMessage());
        return problem(
            HttpStatus.NOT_FOUND,
            "HOUSEHOLD_NOT_FOUND",
            "Household not found",
            "No household with this identifier is visible to the authenticated user.",
            request,
            List.of()
        );
    }

    @ExceptionHandler(HouseholdAccessDeniedException.class)
    public ResponseEntity<ProblemDto> handleAccessDenied(HouseholdAccessDeniedException e, HttpServletRequest request) {
        log.info("Household access denied");
        return problem(
            HttpStatus.FORBIDDEN,
            "HOUSEHOLD_ACCESS_DENIED",
            "Household access denied",
            "You do not have access to this household.",
            request,
            List.of()
        );
    }

    @ExceptionHandler(ForbiddenRoleException.class)
    public ResponseEntity<ProblemDto> handleForbiddenRole(ForbiddenRoleException e, HttpServletRequest request) {
        log.info("Operation rejected: caller role insufficient");
        return problem(
            HttpStatus.FORBIDDEN,
            "FORBIDDEN_ROLE",
            "Insufficient role",
            "Your role in this household does not permit this operation.",
            request,
            List.of()
        );
    }

    @ExceptionHandler(MemberNotFoundException.class)
    public ResponseEntity<ProblemDto> handleMemberNotFound(MemberNotFoundException e, HttpServletRequest request) {
        log.info("Member lookup rejected: no such membership");
        return problem(
            HttpStatus.NOT_FOUND,
            "MEMBER_NOT_FOUND",
            "Member not found",
            "The referenced user has no membership in this household.",
            request,
            List.of()
        );
    }

    @ExceptionHandler(OwnerCannotBeRemovedException.class)
    public ResponseEntity<ProblemDto> handleOwnerCannotBeRemoved(OwnerCannotBeRemovedException e, HttpServletRequest request) {
        log.info("Member removal rejected: target is the owner");
        return problem(
            HttpStatus.CONFLICT,
            "OWNER_CANNOT_BE_REMOVED",
            "Owner cannot be removed",
            "The household owner cannot be removed. Ownership transfer is not supported.",
            request,
            List.of()
        );
    }

    @ExceptionHandler(InviteLimitReachedException.class)
    public ResponseEntity<ProblemDto> handleInviteLimitReached(InviteLimitReachedException e, HttpServletRequest request) {
        log.info("Invite creation rejected: live-invite limit reached");
        return problem(
            HttpStatus.CONFLICT,
            "INVITE_LIMIT_REACHED",
            "Invite limit reached",
            "The household already has the maximum number of live invites. Revoke one before creating another.",
            request,
            List.of()
        );
    }

    @ExceptionHandler(InviteNotFoundException.class)
    public ResponseEntity<ProblemDto> handleInviteNotFound(InviteNotFoundException e, HttpServletRequest request) {
        log.info("Invite lookup rejected: no matching live invite");
        return problem(
            HttpStatus.NOT_FOUND,
            "INVITE_NOT_FOUND",
            "Invite not found",
            "No invitation matches the supplied code.",
            request,
            List.of()
        );
    }

    @ExceptionHandler(InviteAlreadyUsedException.class)
    public ResponseEntity<ProblemDto> handleInviteAlreadyUsed(InviteAlreadyUsedException e, HttpServletRequest request) {
        log.info("Invite redemption rejected: already used");
        return problem(
            HttpStatus.CONFLICT,
            "INVITE_ALREADY_USED",
            "Invite already used",
            "This invitation has already been redeemed.",
            request,
            List.of()
        );
    }

    @ExceptionHandler(InviteExpiredException.class)
    public ResponseEntity<ProblemDto> handleInviteExpired(InviteExpiredException e, HttpServletRequest request) {
        log.info("Invite redemption rejected: expired");
        return problem(
            HttpStatus.GONE,
            "INVITE_EXPIRED",
            "Invite expired",
            "This invitation has expired. Ask the household owner for a new one.",
            request,
            List.of()
        );
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ProblemDto> handleValidation(MethodArgumentNotValidException e, HttpServletRequest request) {
        List<ProblemErrorsInnerDto> errors = e.getBindingResult().getFieldErrors().stream()
            .map(fe -> new ProblemErrorsInnerDto(fe.getField(), fe.getDefaultMessage()))
            .toList();

        return problem(
            HttpStatus.BAD_REQUEST,
            "VALIDATION_ERROR",
            "Validation failed",
            "One or more fields are invalid.",
            request,
            errors
        );
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ProblemDto> handleUnreadable(HttpMessageNotReadableException e, HttpServletRequest request) {
        log.debug("Malformed request body", e);
        return problem(
            HttpStatus.BAD_REQUEST,
            "VALIDATION_ERROR",
            "Validation failed",
            "Request body missing or malformed.",
            request,
            List.of()
        );
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ProblemDto> handleTypeMismatch(MethodArgumentTypeMismatchException e, HttpServletRequest request) {
        return problem(
            HttpStatus.BAD_REQUEST,
            "VALIDATION_ERROR",
            "Validation failed",
            "Request parameter has invalid format.",
            request,
            List.of()
        );
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDto> handleUnexpected(Exception e, HttpServletRequest request) {
        log.error("Unhandled exception", e);
        return problem(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Internal server error",
            "An unexpected error occurred.",
            request,
            List.of()
        );
    }

    private ResponseEntity<ProblemDto> problem(
        HttpStatus status,
        String code,
        String title,
        String detail,
        HttpServletRequest request,
        List<ProblemErrorsInnerDto> errors
    ) {
        UUID correlationId = (UUID) request.getAttribute(CorrelationIdFilter.REQUEST_ATTRIBUTE);
        ProblemDto problem = new ProblemDto(
            PROBLEM_BASE_URI + code.toLowerCase().replace('_', '-'),
            title,
            status.value(),
            code,
            detail,
            correlationId
        );
        problem.setInstance(request.getRequestURI());
        if (!errors.isEmpty()) {
            problem.setErrors(errors);
        }
        return ResponseEntity.status(status)
            .contentType(org.springframework.http.MediaType.APPLICATION_PROBLEM_JSON)
            .body(problem);
    }
}
