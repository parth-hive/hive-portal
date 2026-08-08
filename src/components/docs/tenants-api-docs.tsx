import { Section, Code, CodeBlock, ParamTable } from "@/components/api-docs";

/**
 * Tenants API reference content — portal-internal only (the endpoint returns
 * PII, so unlike the inventory docs this is never published on the public
 * /docs site). The API itself lives in src/app/api/tenants/ — keep this in
 * sync when it changes.
 */
export function TenantsApiDocs() {
  return (
    <>
      <Section title="Authentication">
        <p>
          Every request needs a bearer token in the <Code>Authorization</Code>{" "}
          header. The token is the <Code>TENANTS_API_KEY</Code> environment
          value — deliberately separate from <Code>INVENTORY_API_KEY</Code>,
          because this API returns tenant PII that inventory-key holders
          should not see. If the key isn&apos;t configured on the server, the
          API responds <Code>503</Code> (disabled).
        </p>
        <CodeBlock>{`curl -H "Authorization: Bearer $TENANTS_API_KEY" \\
  https://your-portal-domain/api/tenants`}</CodeBlock>
        <p>
          A missing or wrong token gets <Code>401 {"{"}&quot;error&quot;:
          &quot;unauthorized&quot;{"}"}</Code>.
        </p>
      </Section>

      <Section title="GET /api/tenants">
        <p>
          Contact info for every tenant with an <em>active</em> tenancy —
          name, email, phone, unit, and room. Optional query params filter the
          list; combine them freely:
        </p>
        <ParamTable
          rows={[
            [
              "phone",
              "any phone format — digits are extracted and matched on the last 10",
              "—",
            ],
            ["q", "case-insensitive substring over name and email", "—"],
          ]}
        />
        <CodeBlock>{`GET /api/tenants?phone=%2B1%20(212)%20365-4373

{
  "as_of": "2026-08-08",
  "count": 1,
  "tenants": [
    {
      "id": "e7be6038-7937-4d15-966d-3f9999d78110",
      "name": "Karthik Vinod",
      "email": "krtvin18@gmail.com",
      "phone": "212-365-4373",
      "unit": "161 Van Wagenen Ave Apt 1001",
      "room": "3"
    }
  ]
}`}</CodeBlock>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
          <li>
            <Code>as_of</Code> — the Eastern-time date the active-tenancy set
            was evaluated against.
          </li>
          <li>
            <Code>email</Code> / <Code>phone</Code> — both nullable; not every
            tenant has them on file. <Code>phone</Code> is returned exactly as
            stored (any format).
          </li>
          <li>
            <Code>unit</Code> — display title: building name if set, else
            street address, plus apartment number.
          </li>
          <li>
            <Code>room</Code> — room number with any leading &quot;Room&quot;
            prefix stripped; <Code>null</Code> when no room is assigned.
          </li>
          <li>
            <Code>phone=</Code> matching normalizes both sides to digits and
            compares the last 10 — <Code>+1 (212) 365-4373</Code>,{" "}
            <Code>212-365-4373</Code> and <Code>2123654373</Code> all resolve
            the same tenant. Fewer than 10 digits is a <Code>400</Code>.
          </li>
        </ul>
      </Section>

      <Section title="Errors">
        <p>
          Errors are always JSON: <Code>{`{ "error": "<message>" }`}</Code>.
        </p>
        <ParamTable
          header={["Status", "Meaning", ""]}
          rows={[
            ["400", "phone param has fewer than 10 digits", ""],
            ["401", "Missing or wrong bearer token", ""],
            ["500", "Database error (message included)", ""],
            ["503", "The API is not configured on the server", ""],
          ]}
        />
      </Section>
    </>
  );
}
