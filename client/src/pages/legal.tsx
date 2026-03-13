import { Link } from "wouter";
import logoImg from "@assets/flapfutureslogo_nobg.png";
import { ArrowLeft } from "lucide-react";

function LegalLayout({ title, subtitle, updated, children }: {
  title: string;
  subtitle: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a0614] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0a0614]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <img src={logoImg} alt="Flap Futures" className="w-7 h-7" />
            <span className="font-heading font-bold text-sm text-white hidden sm:block">FLAP FUTURES</span>
          </Link>
          <span className="text-white/20">|</span>
          <span className="text-white/50 text-sm">{title}</span>
          <div className="ml-auto">
            <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to home
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="border-b border-white/5 bg-gradient-to-br from-[#7a33fa]/10 via-transparent to-transparent">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#7a33fa]/15 border border-[#7a33fa]/30 mb-5">
            <span className="text-[#7a33fa] text-xs font-mono font-semibold uppercase tracking-widest">Legal</span>
          </div>
          <h1 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl tracking-tight mb-4">{title}</h1>
          <p className="text-white/50 text-sm sm:text-base mb-1">{subtitle}</p>
          <p className="text-white/30 text-xs font-mono">Last updated: {updated}</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="prose prose-invert prose-sm sm:prose-base max-w-none
          prose-headings:font-heading prose-headings:font-bold prose-headings:text-white prose-headings:tracking-tight
          prose-h2:text-xl prose-h2:sm:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:border-b prose-h2:border-white/10 prose-h2:pb-3
          prose-h3:text-base prose-h3:sm:text-lg prose-h3:mt-6 prose-h3:mb-2 prose-h3:text-white/90
          prose-p:text-white/55 prose-p:leading-relaxed
          prose-li:text-white/55 prose-li:leading-relaxed
          prose-strong:text-white/80 prose-strong:font-semibold
          prose-a:text-[#7a33fa] prose-a:no-underline hover:prose-a:underline
          prose-ul:my-3 prose-ol:my-3">
          {children}
        </div>

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-white/10 flex flex-wrap gap-4 text-xs text-white/30">
          {[
            { label: "Terms of Service",  href: "/terms" },
            { label: "Privacy Policy",    href: "/privacy" },
            { label: "Risk Disclosure",   href: "/risk" },
            { label: "Cookie Policy",     href: "/cookies" },
          ].map(l => (
            <Link key={l.href} href={l.href} className="hover:text-white/60 transition-colors">{l.label}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TermsOfService() {
  return (
    <LegalLayout
      title="Terms of Service"
      subtitle="Please read these terms carefully before using Flap Futures."
      updated="March 1, 2026"
    >
      <h2>1. Acceptance of Terms</h2>
      <p>
        By accessing or using the Flap Futures platform, interface, or associated smart contracts ("the Platform"),
        you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you must not
        use the Platform.
      </p>
      <p>
        These Terms constitute a legally binding agreement between you and Flap Futures ("we", "us", "our").
        We reserve the right to modify these Terms at any time. Continued use after modifications constitutes
        acceptance of the revised Terms.
      </p>

      <h2>2. Eligibility</h2>
      <p>You represent and warrant that you:</p>
      <ul>
        <li>Are at least 18 years of age (or the age of majority in your jurisdiction)</li>
        <li>Have the legal capacity to enter into binding agreements</li>
        <li>Are not located in, incorporated in, or a citizen or resident of a Restricted Territory (including but not limited to the United States, its territories, and any jurisdiction where use of the Platform would be prohibited by applicable law)</li>
        <li>Are not a Politically Exposed Person (PEP) or subject to any sanctions lists</li>
        <li>Are accessing the Platform solely for your own account and not on behalf of any other person or entity without disclosure</li>
      </ul>

      <h2>3. Non-Custodial Platform</h2>
      <p>
        Flap Futures is a non-custodial, decentralised protocol. We do not hold, control, or have access to your
        digital assets at any time. All transactions are executed autonomously by smart contracts deployed on the
        BNB Smart Chain. You retain full custody of your assets through your own wallet at all times.
      </p>
      <p>
        We provide a user interface to interact with public, permissionless smart contracts. The protocol operates
        independently of any centralised entity, and we cannot halt, reverse, or modify on-chain transactions.
      </p>

      <h2>4. Prohibited Use</h2>
      <p>You agree not to use the Platform to:</p>
      <ul>
        <li>Violate any applicable law, regulation, or third-party rights</li>
        <li>Engage in market manipulation, wash trading, spoofing, or any form of deceptive trading practice</li>
        <li>Launder money, finance terrorism, or engage in any other illegal financial activity</li>
        <li>Attempt to exploit, hack, or interfere with the smart contracts or user interface</li>
        <li>Circumvent geographic restrictions or access controls</li>
        <li>Use automated bots or scrapers against the interface without our prior written consent (note: on-chain bot interaction with contracts is permissionless and not restricted by this clause)</li>
      </ul>

      <h2>5. Market Creation</h2>
      <p>
        Any user may create a perpetual market on Flap Futures by depositing collateral into a vault and interacting
        with the factory smart contract. Market creators acknowledge that:
      </p>
      <ul>
        <li>Their vault collateral is locked for the duration specified at market creation</li>
        <li>Market parameters (spread, leverage, max position) are calculated algorithmically from live market cap data and cannot be manually overridden except through the admin interface</li>
        <li>They are solely responsible for ensuring sufficient vault and insurance balances to cover trader positions</li>
        <li>Flap Futures does not guarantee market liquidity, price accuracy, or solvency of any individual market</li>
      </ul>

      <h2>6. No Investment Advice</h2>
      <p>
        Nothing on the Platform constitutes financial, investment, legal, tax, or trading advice. All information
        is provided for informational purposes only. You should consult qualified professionals before making any
        financial decisions. Trading perpetual contracts with leverage carries a high risk of loss and may not
        be suitable for all users.
      </p>

      <h2>7. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by applicable law, Flap Futures and its affiliates, contributors, and
        service providers shall not be liable for any indirect, incidental, special, consequential, or punitive
        damages, including but not limited to: loss of profits, loss of funds, loss of data, smart contract bugs
        or exploits, oracle failures, network congestion, or any other loss arising from use of the Platform.
      </p>
      <p>
        The Platform is provided "as is" without any warranty of any kind. We do not warrant that the interface
        will be uninterrupted, error-free, or secure.
      </p>

      <h2>8. Intellectual Property</h2>
      <p>
        The Flap Futures name, logo, interface design, and documentation are proprietary to Flap Futures. The
        underlying smart contract code is open source under the MIT license unless otherwise stated. You may not
        reproduce, distribute, or create derivative works of our proprietary materials without prior written consent.
      </p>

      <h2>9. Termination</h2>
      <p>
        We may suspend or terminate your access to the interface (but not the underlying protocol) at our
        discretion, for any reason, including violation of these Terms. Because the protocol is decentralised,
        such termination affects only your access to the Flap Futures user interface, not the smart contracts
        themselves.
      </p>

      <h2>10. Governing Law</h2>
      <p>
        These Terms shall be governed by and construed in accordance with the laws of a jurisdiction to be
        determined by Flap Futures. Any disputes shall be resolved through binding arbitration rather than
        court proceedings, to the maximum extent permitted by law.
      </p>

      <h2>11. Contact</h2>
      <p>
        For questions about these Terms, please contact us at <strong>legal@flapfutures.com</strong>.
      </p>
    </LegalLayout>
  );
}

export function PrivacyPolicy() {
  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="How we collect, use, and protect your information."
      updated="March 1, 2026"
    >
      <h2>1. Overview</h2>
      <p>
        Flap Futures ("we", "us") is committed to protecting your privacy. This Privacy Policy explains what
        information we collect when you visit flapfutures.com, how we use it, and your rights regarding that
        information.
      </p>
      <p>
        Because Flap Futures is a non-custodial DeFi platform, we do not collect or store private keys, seed
        phrases, passwords, or asset balances. Your wallet interacts directly with the blockchain — we see
        only what is publicly visible on-chain.
      </p>

      <h2>2. Information We Collect</h2>
      <h3>2.1 Automatically Collected</h3>
      <ul>
        <li><strong>IP address</strong> — used for approximate geographic analytics (country-level only) and abuse prevention. Stored in anonymised, hashed form.</li>
        <li><strong>Browser &amp; device information</strong> — user agent string, browser type, screen resolution, used to improve compatibility.</li>
        <li><strong>Pages visited and session duration</strong> — used for internal traffic analytics to understand which parts of the platform are most used.</li>
        <li><strong>Referral source</strong> — the URL you arrived from, if available.</li>
      </ul>
      <h3>2.2 Wallet Addresses</h3>
      <p>
        When you connect a wallet and sign a message to authenticate, your public wallet address is stored in
        our database linked to your session. This address is a public blockchain identifier — it is not
        personally identifying information by itself. We do not request or store any other wallet credentials.
      </p>
      <h3>2.3 Market &amp; Trade Data</h3>
      <p>
        If you create a market or execute trades, the relevant on-chain data (transaction hashes, positions,
        vault balances) is indexed from the blockchain and stored in our database to power the interface. This
        data is inherently public.
      </p>

      <h2>3. How We Use Your Information</h2>
      <ul>
        <li>To display the platform interface correctly and maintain your session</li>
        <li>To analyse aggregate traffic patterns and improve the platform</li>
        <li>To detect and prevent abuse, fraud, or attacks</li>
        <li>To comply with legal obligations</li>
        <li>To contact you if you have submitted a support request or bug report</li>
      </ul>
      <p>We do not sell, rent, or share your personal information with third parties for marketing purposes.</p>

      <h2>4. Third-Party Services</h2>
      <p>We use the following third-party services which may process your data:</p>
      <ul>
        <li><strong>ip-api.com</strong> — country-level IP geolocation for analytics. Your IP may be sent to this service.</li>
        <li><strong>DexScreener / Moralis</strong> — token price and market cap data. These requests are server-side only.</li>
        <li><strong>BNB Smart Chain RPC nodes</strong> — all blockchain reads and writes pass through public or third-party RPC endpoints.</li>
      </ul>
      <p>
        We are not responsible for the privacy practices of these third-party services. We encourage you to
        review their privacy policies.
      </p>

      <h2>5. Cookies</h2>
      <p>
        We use a small number of essential cookies to maintain your session and preferences. For full details,
        see our <a href="/cookies">Cookie Policy</a>.
      </p>

      <h2>6. Data Retention</h2>
      <p>
        Session data is retained for 30 days. Aggregate traffic analytics are retained for 12 months. On-chain
        market and trade data is retained indefinitely as it mirrors public blockchain state. You may request
        deletion of off-chain data associated with your wallet address by contacting us.
      </p>

      <h2>7. Your Rights</h2>
      <p>Depending on your jurisdiction, you may have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you</li>
        <li>Request correction of inaccurate data</li>
        <li>Request deletion of your data (subject to legal retention obligations)</li>
        <li>Object to or restrict processing of your data</li>
        <li>Data portability</li>
      </ul>
      <p>To exercise these rights, contact us at <strong>privacy@flapfutures.com</strong>.</p>

      <h2>8. Security</h2>
      <p>
        We implement reasonable technical and organisational measures to protect your data, including encrypted
        database connections, hashed identifiers, and access controls. However, no system is completely secure,
        and we cannot guarantee absolute security.
      </p>

      <h2>9. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify users of significant changes by
        updating the "last updated" date at the top of this page. Continued use of the Platform after changes
        constitutes acceptance.
      </p>

      <h2>10. Contact</h2>
      <p>Privacy-related inquiries: <strong>privacy@flapfutures.com</strong></p>
    </LegalLayout>
  );
}

export function RiskDisclosure() {
  return (
    <LegalLayout
      title="Risk Disclosure"
      subtitle="Trading perpetual contracts involves significant risk. Please read before trading."
      updated="March 1, 2026"
    >
      <p>
        <strong>This document outlines the key risks associated with using the Flap Futures platform. It is not
        exhaustive. Trading leveraged perpetual contracts is high risk and may result in the total loss of your
        deposited funds.</strong>
      </p>

      <h2>1. Leverage Risk</h2>
      <p>
        Flap Futures allows trading with leverage of up to 10×, depending on market conditions. Leverage amplifies
        both gains and losses. A small adverse price movement can result in the complete loss of your position
        collateral. For example, at 10× leverage, a 10% price move against your position results in total loss
        of margin before any fees.
      </p>
      <p>
        Positions are automatically liquidated when margin falls below the liquidation threshold. You may lose
        your entire deposited collateral and, in extreme cases, losses could exceed your initial deposit.
      </p>

      <h2>2. Market Volatility</h2>
      <p>
        The tokens available on Flap Futures are micro-cap and small-cap assets on BNB Smart Chain. These
        assets are subject to extreme price volatility. Prices can move 50% or more within minutes due to
        low liquidity, coordinated trading activity, or news events. High volatility significantly increases
        the risk of liquidation.
      </p>

      <h2>3. Smart Contract Risk</h2>
      <p>
        Flap Futures operates through smart contracts deployed on BNB Smart Chain. Smart contracts may contain
        bugs, logic errors, or vulnerabilities that could result in loss of funds. While we conduct internal
        reviews of our contract code, no audit can guarantee the complete absence of vulnerabilities.
      </p>
      <p>
        Smart contracts are immutable once deployed. We cannot reverse or modify transactions executed by the
        contracts. If a bug is exploited, affected funds may be unrecoverable.
      </p>

      <h2>4. Oracle Risk</h2>
      <p>
        The platform uses an on-chain oracle to determine mark prices for positions, funding rates, and
        liquidations. Oracle prices are pushed by a bot wallet at regular intervals. In the event of oracle
        failure, network congestion, or price manipulation, the mark price may deviate significantly from
        the true market price, potentially triggering incorrect liquidations or enabling exploitative trading.
      </p>

      <h2>5. Liquidity Risk</h2>
      <p>
        Each market has a finite vault backing trader payouts. If the vault balance is insufficient to cover
        all winning positions, payouts may be limited. Markets with low vault balances or high open interest
        relative to vault size carry elevated counterparty risk. Always check vault depth before opening
        large positions.
      </p>

      <h2>6. Counterparty Risk</h2>
      <p>
        Unlike centralised exchanges, there is no insurance fund managed by Flap Futures. Each market's
        insurance is provided solely by the market creator and is limited to the creator's insurance deposit.
        If a market becomes insolvent, losses may not be fully covered.
      </p>

      <h2>7. Regulatory Risk</h2>
      <p>
        The regulatory environment for decentralised finance (DeFi) and cryptocurrency trading is evolving
        rapidly and varies by jurisdiction. Using Flap Futures may be restricted or prohibited in your
        country. It is your responsibility to determine whether your use of the Platform is legal in your
        jurisdiction. Changes in regulation could impact the availability or legality of the Platform.
      </p>

      <h2>8. Technology Risk</h2>
      <ul>
        <li><strong>Network congestion</strong> — BNB Smart Chain may experience congestion, causing delayed or failed transactions</li>
        <li><strong>Wallet security</strong> — loss of your private key means permanent, irreversible loss of access to your funds</li>
        <li><strong>Interface unavailability</strong> — the Flap Futures interface may become temporarily unavailable due to maintenance or technical issues; however the underlying contracts remain accessible</li>
        <li><strong>Front-end risks</strong> — phishing sites may impersonate Flap Futures; always verify you are on flapfutures.com</li>
      </ul>

      <h2>9. Tax Risk</h2>
      <p>
        Trading profits, realised gains, and other transactions on Flap Futures may be subject to taxation in
        your jurisdiction. You are solely responsible for determining and fulfilling your tax obligations. Flap
        Futures does not provide tax advice and does not report your trading activity to any tax authority.
      </p>

      <h2>10. No Guarantee of Profit</h2>
      <p>
        Past performance of any token, market, or trading strategy is not indicative of future results. There
        is no guarantee that any trading activity will be profitable. You should only trade with funds you can
        afford to lose entirely.
      </p>

      <h2>11. Acknowledgement</h2>
      <p>
        By using Flap Futures, you acknowledge that you have read and understood this Risk Disclosure, that
        you are aware of the risks involved, and that you accept full responsibility for any losses incurred
        through your use of the Platform.
      </p>
      <p>
        If you have questions about these risks, contact us at <strong>support@flapfutures.com</strong> before
        trading.
      </p>
    </LegalLayout>
  );
}

export function CookiePolicy() {
  return (
    <LegalLayout
      title="Cookie Policy"
      subtitle="How we use cookies and similar technologies on flapfutures.com."
      updated="March 1, 2026"
    >
      <h2>1. What Are Cookies?</h2>
      <p>
        Cookies are small text files that a website stores on your device when you visit. They allow the site
        to remember information about your visit, such as your session state or preferences. Similar technologies
        include local storage and session storage used by web applications.
      </p>

      <h2>2. Cookies We Use</h2>
      <p>Flap Futures uses a minimal set of cookies. We do not use advertising or tracking cookies.</p>

      <h3>Essential Cookies</h3>
      <p>
        These cookies are strictly necessary for the Platform to function. Without them, you cannot authenticate
        or maintain a session.
      </p>
      <ul>
        <li>
          <strong>Session cookie</strong> — set when you sign in with your wallet. Maintains your authenticated
          session across page loads. Expires at browser close or after 7 days. This cookie is
          HttpOnly and cannot be accessed by JavaScript.
        </li>
      </ul>
      <p>
        Essential cookies do not require your consent as they are necessary for the service to function. They
        cannot be disabled without preventing you from using authenticated features.
      </p>

      <h3>Analytics (First-Party)</h3>
      <p>
        We run our own privacy-focused, first-party analytics to understand how the Platform is used. This
        does not use Google Analytics or any third-party analytics platform.
      </p>
      <ul>
        <li>
          <strong>Visitor fingerprint</strong> — a server-side, anonymised hash derived from your IP address
          and browser user agent. Not a cookie — never stored on your device. Used to count unique visitors
          in aggregate. No personal data leaves our servers for this purpose.
        </li>
      </ul>

      <h3>Local Storage</h3>
      <p>
        The Platform uses browser local storage for UI preferences such as wallet connection state and
        UI settings. This data stays on your device and is never sent to our servers.
      </p>

      <h2>3. Cookies We Do NOT Use</h2>
      <ul>
        <li>Advertising or retargeting cookies</li>
        <li>Third-party tracking cookies (e.g. Facebook Pixel, Google Analytics)</li>
        <li>Cross-site tracking technologies</li>
        <li>Cookies that profile your browsing behaviour across other websites</li>
      </ul>

      <h2>4. Third-Party Cookies</h2>
      <p>
        We do not embed third-party scripts that set cookies on flapfutures.com. However, wallet providers
        (such as MetaMask browser extension) may set their own cookies or use local storage independently
        of our Platform. We have no control over these.
      </p>

      <h2>5. Managing Cookies</h2>
      <p>
        You can control and delete cookies through your browser settings. Note that disabling the session
        cookie will prevent you from logging in to the Platform. Below are links to cookie management
        instructions for common browsers:
      </p>
      <ul>
        <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">Google Chrome</a></li>
        <li><a href="https://support.mozilla.org/en-US/kb/clear-cookies-and-site-data-firefox" target="_blank" rel="noopener noreferrer">Mozilla Firefox</a></li>
        <li><a href="https://support.apple.com/en-gb/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer">Apple Safari</a></li>
        <li><a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge" target="_blank" rel="noopener noreferrer">Microsoft Edge</a></li>
      </ul>

      <h2>6. Changes to This Policy</h2>
      <p>
        We may update this Cookie Policy if we change how we use cookies. Any changes will be reflected by
        updating the date at the top of this page. We will not start using new non-essential cookies without
        updating this policy.
      </p>

      <h2>7. Contact</h2>
      <p>
        Questions about our use of cookies: <strong>privacy@flapfutures.com</strong>
      </p>
    </LegalLayout>
  );
}
