import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen p-4" style={{ background: 'var(--console-bg)' }}>
      <div className="max-w-3xl mx-auto">
        <div
          className="panel"
          style={{ border: '3px solid var(--panel-edge)', borderRadius: 4, padding: 20 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h1 className="lcd-text lcd-green text-xl">Privacy Policy</h1>
            <button
              className="hw-btn px-3 py-1 text-xs text-gray-400"
              onClick={() => navigate(-1)}
            >
              Back
            </button>
          </div>

          <p className="lcd-text lcd-dim text-xs mb-6">Last updated: March 18, 2026</p>

          <div className="space-y-6 text-sm leading-relaxed" style={{ color: '#999' }}>
            <section>
              <h2 className="lcd-text lcd-amber text-base mb-2">1. Data Controller</h2>
              <p>
                This vFSS Phone Simulator ("Service") is operated by ZLC ARTCC as a VATSIM training
                and testing tool. For questions about this policy, contact us via the ZLC ARTCC website.
              </p>
            </section>

            <section>
              <h2 className="lcd-text lcd-amber text-base mb-2">2. Data We Collect</h2>
              <p className="mb-2">When you sign in via VATSIM Connect, we receive and process:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>VATSIM CID</strong> — your unique VATSIM identifier</li>
                <li><strong>Full name</strong> — as registered with VATSIM</li>
                <li><strong>ATC rating</strong> — your controller rating level</li>
              </ul>
              <p className="mt-2">
                We do <strong>not</strong> request or store your email address, country, or VATSIM password.
              </p>
            </section>

            <section>
              <h2 className="lcd-text lcd-amber text-base mb-2">3. Legal Basis for Processing</h2>
              <p>
                We process your data based on your <strong>consent</strong> (Article 6(1)(a) GDPR), given
                when you choose to sign in with your VATSIM account. You may withdraw consent at any
                time by signing out and ceasing to use the Service.
              </p>
            </section>

            <section>
              <h2 className="lcd-text lcd-amber text-base mb-2">4. How We Use Your Data</h2>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>To authenticate you and display your identity to other participants during calls</li>
                <li>To associate controller registrations and call records with your VATSIM CID</li>
              </ul>
            </section>

            <section>
              <h2 className="lcd-text lcd-amber text-base mb-2">5. Data Storage and Retention</h2>
              <p>
                Your VATSIM profile data is stored in a short-lived JSON Web Token (JWT) in your
                browser's local storage. The token expires after 8 hours. The server holds your data
                in memory only for the duration of your session — <strong>no database or persistent
                storage is used</strong>. When you disconnect or the server restarts, all session data
                is deleted.
              </p>
            </section>

            <section>
              <h2 className="lcd-text lcd-amber text-base mb-2">6. Voice Communication</h2>
              <p>
                Voice calls are transmitted peer-to-peer via WebRTC. Audio streams pass directly
                between participants and are <strong>not recorded, stored, or processed</strong> by
                our server. The server only relays signaling metadata (connection setup) required
                to establish the peer-to-peer connection.
              </p>
            </section>

            <section>
              <h2 className="lcd-text lcd-amber text-base mb-2">7. Third-Party Services</h2>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>
                  <strong>VATSIM Connect</strong> — used for authentication. VATSIM's own privacy
                  policy governs how they handle your data.
                </li>
                <li>
                  <strong>Google STUN servers</strong> — used for WebRTC NAT traversal. Only your
                  IP address is visible to these servers as part of the standard ICE protocol.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="lcd-text lcd-amber text-base mb-2">8. Your Rights</h2>
              <p className="mb-2">Under the GDPR, you have the right to:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Access</strong> — request a copy of data we hold about you</li>
                <li><strong>Rectification</strong> — your data comes from VATSIM; update it there</li>
                <li><strong>Erasure</strong> — sign out and clear browser storage; no persistent data remains</li>
                <li><strong>Withdraw consent</strong> — stop using the Service at any time</li>
                <li><strong>Lodge a complaint</strong> — with your local data protection authority</li>
              </ul>
            </section>

            <section>
              <h2 className="lcd-text lcd-amber text-base mb-2">9. Cookies</h2>
              <p>
                This Service does not use cookies. Authentication tokens are stored in browser
                local storage and are not sent to third parties.
              </p>
            </section>

            <section>
              <h2 className="lcd-text lcd-amber text-base mb-2">10. Changes to This Policy</h2>
              <p>
                We may update this policy from time to time. The "Last updated" date at the top
                of this page reflects the most recent revision.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
