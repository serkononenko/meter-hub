"use client";

import * as React from "react";
import {useQueryClient} from "@tanstack/react-query";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import UpgradeIcon from "@mui/icons-material/Upgrade";

import {isErrorResponse} from "@/lib/api/problems";
import {
  getListProvidersQueryKey,
  useListProviders,
  usePromoteProvider,
} from "@/lib/api/generated/provider-service";
import type {Provider} from "@/lib/api/generated/provider-service/model";
import {formatRuleInWords, providerScopeLabels} from "@/lib/providers/labels";
import {providerProblemMessage} from "@/lib/providers/problems";

import {CatalogProviderDialog} from "./catalog-provider-dialog";

/**
 * Admin view over the provider catalog: global providers to curate, plus
 * household-private providers currently in use with a promote action.
 */
export function CatalogManager(): React.JSX.Element {
  const providersQuery = useListProviders({includeArchived: true});
  const [dialogProvider, setDialogProvider] = React.useState<Provider | "new" | null>(null);

  const response = providersQuery.data;

  if (providersQuery.isPending) {
    return <Skeleton height={220} variant="rounded" />;
  }

  if (providersQuery.isError || !response || isErrorResponse(response)) {
    return (
      <Card>
        <CardContent>
          <Typography color="error" variant="body2">
            Could not load the provider catalog.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const providers = response.data;
  const global = providers.filter((provider) => provider.scope === "GLOBAL");
  const privateInUse = providers.filter((provider) => provider.scope === "HOUSEHOLD");

  return (
    <Stack spacing={4}>
      <Stack spacing={2}>
        <Stack direction="row" sx={{alignItems: "center", justifyContent: "space-between"}}>
          <Typography variant="h5">Catalog providers</Typography>
          <Button onClick={() => setDialogProvider("new")} startIcon={<AddIcon />} variant="contained">
            Add provider
          </Button>
        </Stack>
        {global.length === 0 ? (
          <Card>
            <CardContent>
              <Stack spacing={1} sx={{alignItems: "center", py: 4}}>
                <Typography variant="h6">The catalog is empty</Typography>
                <Typography color="text.secondary" sx={{textAlign: "center"}} variant="body2">
                  Add the first provider so households can link their utility
                  accounts.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        ) : (
          <Stack spacing={2} sx={{display: "grid", gap: 2, gridTemplateColumns: {md: "repeat(2, 1fr)"}}}>
            {global.map((provider) => (
              <CatalogProviderCard key={provider.id} onEdit={() => setDialogProvider(provider)} provider={provider} />
            ))}
          </Stack>
        )}
      </Stack>
      <Divider />
      <PrivateProviders providers={privateInUse} />
      {dialogProvider !== null ? (
        <CatalogProviderDialog
          key={dialogProvider === "new" ? "new" : dialogProvider.id}
          onClose={() => setDialogProvider(null)}
          open
          provider={dialogProvider === "new" ? null : dialogProvider}
        />
      ) : null}
    </Stack>
  );
}

function CatalogProviderCard({provider, onEdit}: {provider: Provider; onEdit: () => void}): React.JSX.Element {
  return (
    <Card sx={provider.archived ? {opacity: 0.6} : undefined}>
      <CardContent>
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} sx={{alignItems: "center", justifyContent: "space-between"}}>
            <Typography variant="h6">{provider.name}</Typography>
            {provider.archived ? <Chip color="default" label="Archived" size="small" /> : null}
          </Stack>
          {provider.notes ? (
            <Typography color="text.secondary" variant="body2">
              {provider.notes}
            </Typography>
          ) : null}
          <Typography color="text.secondary" variant="body2">
            {provider.defaultRule
              ? `Suggested window: ${formatRuleInWords(provider.defaultRule)}.`
              : "No suggested window."}
          </Typography>
          <Button onClick={onEdit} size="small" startIcon={<EditIcon />} sx={{alignSelf: "flex-start"}}>
            Edit
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

/**
 * Private providers in use. A private provider appears here once a
 * household created it; promoting copies it into the catalog for everyone.
 */
function PrivateProviders({providers}: {providers: Provider[]}): React.JSX.Element {
  const queryClient = useQueryClient();
  const promoteMutation = usePromoteProvider();
  const [error, setError] = React.useState<string | null>(null);

  if (providers.length === 0) {
    return (
      <Stack spacing={2}>
        <Typography variant="h5">Private providers</Typography>
        <Typography color="text.secondary" variant="body2">
          Providers that households created privately appear here, ready to
          promote into the shared catalog.
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Private providers</Typography>
      {error ? <Typography color="error" variant="body2">{error}</Typography> : null}
      <Stack spacing={2} sx={{display: "grid", gap: 2, gridTemplateColumns: {md: "repeat(2, 1fr)"}}}>
        {providers.map((provider) => (
          <Card key={provider.id}>
            <CardContent>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} sx={{alignItems: "center", justifyContent: "space-between"}}>
                  <Typography variant="h6">{provider.name}</Typography>
                  <Chip label={providerScopeLabels[provider.scope]} size="small" variant="outlined" />
                </Stack>
                {provider.defaultRule ? (
                  <Typography color="text.secondary" variant="body2">
                    Suggested window: {formatRuleInWords(provider.defaultRule)}.
                  </Typography>
                ) : null}
                <Button
                  color="primary"
                  disabled={promoteMutation.isPending}
                  onClick={() =>
                    void (async () => {
                      setError(null);
                      const response = await promoteMutation.mutateAsync({providerId: provider.id});
                      if (isErrorResponse(response)) {
                        setError(providerProblemMessage(response.data));
                        return;
                      }
                      await queryClient.invalidateQueries({
                        queryKey: getListProvidersQueryKey({includeArchived: true}),
                      });
                    })()
                  }
                  size="small"
                  startIcon={<UpgradeIcon />}
                  sx={{alignSelf: "flex-start"}}
                >
                  Promote to catalog
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}
