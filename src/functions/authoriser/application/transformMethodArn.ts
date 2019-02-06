/**
 * Changes the httpVerb and resourcePath parts of an API gateway Amazon Resource Name (ARN) in to
 * wildcards.
 * Method ARNs are expected to be in the format:
 * arn:aws:execute-api:{regionId}:{accountId}:{appId}/{stage}/{httpVerb}/{resource}/{subresrcs...}
 */
export function toAllVerbsAndAllResources(methodArn: string): string {
  const parts = methodArn && methodArn.split('/');

  if (!parts || parts.length < 2) {
    const methodArnText = typeof methodArn === 'string' ? `"${methodArn}"` : `(${methodArn})`;
    throw new Error(`Failed to extract arnBase and stageName from methodArn: ${methodArnText}`);
  }

  const arnBase = parts[0];
  const stageName = parts[1];
  const httpVerb = '*';
  const resourcePath = '*';

  return `${arnBase}/${stageName}/${httpVerb}/${resourcePath}`;
}
