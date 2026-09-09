package com.meterhub.household.ports.outbound;

import com.meterhub.household.domain.model.HouseholdMember;

import java.util.UUID;

public interface HouseholdMemberRepository {
    HouseholdMember save(HouseholdMember member);
}
