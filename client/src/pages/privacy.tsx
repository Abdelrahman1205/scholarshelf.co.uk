import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { PublicFooter } from "@/components/public-footer";

// ─────────────────────────────────────────────────────────────────────────────
// Privacy Policy — ScholarShelf (BYTE HUB TECHNOLOGY CORPORATE LTD)
// Platform-level legal page. NOT school CMS content: this is our own policy and
// is intentionally hard-coded so its wording is version-controlled and reviewed.
//
// ⚠ DRAFT — to be reviewed by a solicitor / data-protection adviser before it is
// relied upon. Placeholders marked [ ] must be completed.
// ─────────────────────────────────────────────────────────────────────────────

const LAST_UPDATED = "August 2026";

function H({ children }: { children: any }) {
  return <h2 className="text-lg font-heading font-bold text-foreground mt-8 mb-2">{children}</h2>;
}
function P({ children }: { children: any }) {
  return <p className="text-sm text-muted-foreground leading-relaxed mb-3">{children}</p>;
}
function LI({ children }: { children: any }) {
  return <li className="text-sm text-muted-foreground leading-relaxed mb-1.5">{children}</li>;
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 w-full max-w-3xl mx-auto px-5 py-10">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to sign in
        </Link>

        <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mt-2">Last updated: {LAST_UPDATED}</p>

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-900">
            This policy is being finalised with our legal advisers. If anything here is unclear,
            please contact us and we will answer directly.
          </p>
        </div>

        <H>1. Who we are</H>
        <P>
          ScholarShelf is a school book-distribution platform operated by <strong>BYTE HUB TECHNOLOGY
          CORPORATE LTD</strong> ("we", "us"), a company registered in England and Wales,
          company number <strong>16884170</strong>. Registered office: [REGISTERED OFFICE ADDRESS].
        </P>
        <P>
          You can contact us about privacy at <strong>abdelrahman-m@bytehubtech.co.uk</strong>,
          or by post at the address above.
        </P>

        <H>2. Our role, and your school's role</H>
        <P>
          Schools use ScholarShelf to manage the books their pupils receive. For pupil, parent and
          staff information, <strong>your school decides what is collected and why</strong> — the school
          is the data controller, and we act as its data processor, handling the information on the
          school's instructions under a written agreement.
        </P>
        <P>
          We are the controller for a smaller set of data we decide on ourselves: staff accounts we
          create to run the service, our billing relationship with the school, security and audit
          logs, and enquiries you send us through this website.
        </P>
        <P>
          If you are a parent and want to see, correct or delete information about your child, please
          contact your school first — they control that data. We will support them in responding.
        </P>

        <H>3. Information we handle</H>
        <P>On behalf of schools:</P>
        <ul className="list-disc pl-5 mb-3">
          <LI><strong>Pupils:</strong> name, date of birth, year group and class, the books allocated to them, and collection records.</LI>
          <LI><strong>Parents and guardians:</strong> name, relationship to the child, email address, telephone number, the children linked to them, orders and payment references.</LI>
          <LI><strong>School staff:</strong> name, work email, role, and the classes or subjects they are assigned to.</LI>
        </ul>
        <P>For our own purposes:</P>
        <ul className="list-disc pl-5 mb-3">
          <LI>Account credentials (passwords are stored only as a secure one-way hash — never in readable form).</LI>
          <LI>Sign-in and activity records, including IP address, kept for security and audit.</LI>
          <LI>Messages you send us through the contact form.</LI>
        </ul>
        <P>
          <strong>We do not take card payments and never see card details.</strong> Parents pay through
          their school's own payment method; we only record the payment reference the parent supplies so
          the school can verify it.
        </P>

        <H>4. Children's information</H>
        <P>
          Much of the information in ScholarShelf concerns children. We treat it with particular care:
          access is limited strictly by role, so teachers see only their own classes, finance staff see
          only payment information, and staff who manage a school's public website have no access to
          pupil or family information at all. Every school's data is kept separate from every other
          school's. We do not use children's data for marketing, advertising or profiling, and we do
          not sell it to anyone.
        </P>

        <H>5. Why we can use this information (lawful basis)</H>
        <ul className="list-disc pl-5 mb-3">
          <LI><strong>Public task / legitimate interests of the school</strong> — most pupil and parent data is processed so the school can carry out its educational function of providing books.</LI>
          <LI><strong>Contract</strong> — to provide the service to the school, and to process orders and payments parents have asked us to record.</LI>
          <LI><strong>Legitimate interests</strong> — keeping the service secure, preventing misuse, and responding to your enquiries.</LI>
          <LI><strong>Legal obligation</strong> — where we must keep records or respond to lawful requests.</LI>
        </ul>

        <H>6. Who we share it with</H>
        <P>
          We do not sell your information. We share it only with the school it belongs to, and with the
          service providers who help us run ScholarShelf:
        </P>
        <ul className="list-disc pl-5 mb-3">
          <LI><strong>Hosting and application platform</strong> — to run the service.</LI>
          <LI><strong>Database hosting</strong> — to store the data securely.</LI>
          <LI><strong>Email delivery</strong> — to send invitations, payment confirmations and collection notices.</LI>
        </ul>
        <P>
          Each provider is bound by contract to protect the data and to use it only to provide their
          service to us. A current list of our providers is available on request. We may also disclose
          information where the law requires it.
        </P>

        <H>7. Where your information is held</H>
        <P>
          Our providers may store or process data outside the United Kingdom. Where that happens, we
          rely on approved safeguards — such as the UK International Data Transfer Agreement or the UK
          Addendum to the EU Standard Contractual Clauses — so your information keeps an equivalent
          level of protection. [CONFIRM HOSTING REGIONS AND TRANSFER MECHANISM.]
        </P>

        <H>8. How long we keep it</H>
        <P>
          We keep information for as long as the school needs it to run its book distribution, and in
          line with the school's own retention policy. When a school ends its use of ScholarShelf, we
          delete or return its data within [RETENTION PERIOD] of the request. Security and audit logs
          are kept for a limited period for accountability purposes.
        </P>

        <H>9. Keeping information safe</H>
        <P>
          We protect information using encryption in transit, one-way hashed passwords, strict
          role-based access control, separation of each school's data, rate limiting, and audit logging
          of significant actions. No system can be completely secure, but we test our security
          regularly and act quickly on any issue. If a breach occurs that presents a risk to people, we
          will notify the school without undue delay so it can meet its obligations.
        </P>

        <H>10. Your rights</H>
        <P>Under UK data protection law you have the right to:</P>
        <ul className="list-disc pl-5 mb-3">
          <LI>ask what information is held about you, and get a copy of it;</LI>
          <LI>have inaccurate information corrected;</LI>
          <LI>ask for information to be deleted, in certain circumstances;</LI>
          <LI>object to, or ask us to restrict, how it is used;</LI>
          <LI>ask for your information in a portable format;</LI>
          <LI>withdraw consent, where we relied on consent.</LI>
        </ul>
        <P>
          For pupil, parent and staff records, please contact your school first, as they control that
          information. For anything we control, contact us using the details above. You also have the
          right to complain to the Information Commissioner's Office (ICO) at{" "}
          <a href="https://ico.org.uk" target="_blank" rel="noreferrer noopener" className="underline">ico.org.uk</a>.
        </P>

        <H>11. Cookies</H>
        <P>
          ScholarShelf uses a single essential cookie to keep you signed in securely. It is required for
          the service to work and is not used for advertising or tracking. We do not use third-party
          advertising or analytics cookies. [CONFIRM IF ANALYTICS ARE ADDED LATER.]
        </P>

        <H>12. Changes to this policy</H>
        <P>
          If we make significant changes we will update the date at the top of this page and, where
          appropriate, tell schools directly.
        </P>

        <div className="mt-10 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">Questions about this policy?</p>
          <p className="text-sm text-muted-foreground mt-1">
            Email <a href="mailto:abdelrahman-m@bytehubtech.co.uk" className="underline">abdelrahman-m@bytehubtech.co.uk</a>{" "}
            or use our <Link href="/contact" className="underline">contact form</Link>.
          </p>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
