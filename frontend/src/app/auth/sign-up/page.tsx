import type {Metadata} from "next";
import * as React from "react";

import {GuestGuard} from "@/components/auth/guest-guard";
import {AuthLayout} from "@/components/auth/layout";
import {SignUpForm} from "@/components/auth/sign-up-form";

export const metadata = {title: "Sign up | MeterHub"} satisfies Metadata;

export default function Page(): React.JSX.Element {
  return (
    <GuestGuard>
      <AuthLayout>
        <SignUpForm />
      </AuthLayout>
    </GuestGuard>
  );
}
