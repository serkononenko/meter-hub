package com.meterhub.gateway.security;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonTypeName;
import org.springframework.lang.Nullable;

import java.util.Objects;
import java.util.UUID;

/**
 * RFC 9457 problem details response body.
 *
 * <p>Hand-written copy of the identity service's generated DTO: the gateway
 * has no OpenAPI-generated inbound models, and the entry point writes this
 * shape directly. Unlike the identity variant this omits the {@code errors}
 * array, which the gateway never fills.
 */
@JsonTypeName("Problem")
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ProblemDto {

    private String type;

    private String title;

    private Integer status;

    private String code;

    private String detail;

    private String instance;

    private UUID correlationId;

    public ProblemDto(
        String type,
        String title,
        Integer status,
        String code,
        String detail,
        UUID correlationId
    ) {
        this.type = type;
        this.title = title;
        this.status = status;
        this.code = code;
        this.detail = detail;
        this.correlationId = correlationId;
    }

    @JsonProperty("type")
    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    @JsonProperty("title")
    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    @JsonProperty("status")
    public Integer getStatus() {
        return status;
    }

    public void setStatus(Integer status) {
        this.status = status;
    }

    @JsonProperty("code")
    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    @JsonProperty("detail")
    public String getDetail() {
        return detail;
    }

    public void setDetail(String detail) {
        this.detail = detail;
    }

    @Nullable
    @JsonProperty("instance")
    public String getInstance() {
        return instance;
    }

    public void setInstance(String instance) {
        this.instance = instance;
    }

    @Nullable
    @JsonProperty("correlationId")
    public UUID getCorrelationId() {
        return correlationId;
    }

    public void setCorrelationId(UUID correlationId) {
        this.correlationId = correlationId;
    }

    public ProblemDto type(String type) {
        this.type = type;
        return this;
    }

    public ProblemDto title(String title) {
        this.title = title;
        return this;
    }

    public ProblemDto status(Integer status) {
        this.status = status;
        return this;
    }

    public ProblemDto code(String code) {
        this.code = code;
        return this;
    }

    public ProblemDto detail(String detail) {
        this.detail = detail;
        return this;
    }

    public ProblemDto instance(String instance) {
        this.instance = instance;
        return this;
    }

    public ProblemDto correlationId(UUID correlationId) {
        this.correlationId = correlationId;
        return this;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        ProblemDto problem = (ProblemDto) o;
        return Objects.equals(this.type, problem.type)
            && Objects.equals(this.title, problem.title)
            && Objects.equals(this.status, problem.status)
            && Objects.equals(this.code, problem.code)
            && Objects.equals(this.detail, problem.detail)
            && Objects.equals(this.instance, problem.instance)
            && Objects.equals(this.correlationId, problem.correlationId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(type, title, status, code, detail, instance, correlationId);
    }

    @Override
    public String toString() {
        return "class ProblemDto {\n"
            + "    type: " + toIndentedString(type) + "\n"
            + "    title: " + toIndentedString(title) + "\n"
            + "    status: " + toIndentedString(status) + "\n"
            + "    code: " + toIndentedString(code) + "\n"
            + "    detail: " + toIndentedString(detail) + "\n"
            + "    instance: " + toIndentedString(instance) + "\n"
            + "    correlationId: " + toIndentedString(correlationId) + "\n"
            + "}";
    }

    private String toIndentedString(Object o) {
        return o == null ? "null" : o.toString().replace("\n", "\n    ");
    }
}
