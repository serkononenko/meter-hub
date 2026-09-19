import type {Metadata} from "next";
import * as React from "react";

import {GuestGuard} from "@/components/auth/guest-guard";
import {AuthLayout} from "@/components/auth/layout";
import {SignInForm} from "@/components/auth/sign-in-form";

export const metadata = {title: "Sign in | MeterHub"} satisfies Metadata;

export default function Page(): React.JSX.Element {
  return (
    <GuestGuard>
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </GuestGuard>
  );
}
