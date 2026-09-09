package com.meterhub.household.adapters.inbound.web;

import com.meterhub.household.adapters.inbound.web.dto.ProblemDto;
import com.meterhub.household.adapters.inbound.web.dto.ProblemErrorsInnerDto;
import com.meterhub.household.domain.exception.HouseholdNotFoundException;
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
