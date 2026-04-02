export function assertTenantPatchOrganizationInvariant(
  currentOrganizationId: unknown,
  patch: Record<string, unknown>,
): void {
  if (!Object.prototype.hasOwnProperty.call(patch, 'organizationId')) {
    return
  }

  const nextOrganizationId = patch.organizationId

  if (
    typeof currentOrganizationId !== 'string' ||
    (nextOrganizationId !== undefined && nextOrganizationId !== currentOrganizationId)
  ) {
    throw new Error('Tenant record organization mismatch')
  }
}
