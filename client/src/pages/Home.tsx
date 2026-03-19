import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BetaDisclaimer from '../components/common/BetaDisclaimer';

export default function Home() {
  const navigate = useNavigate();
  const { user, isLoading, login, logout } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--console-bg)' }}>
      <div className="w-full max-w-lg">
        <div className="panel" style={{ border: '3px solid var(--panel-edge)', borderRadius: '4px', padding: '20px' }}>
          <div className="flex justify-between items-center mb-4">
            <div className="screw" />
            <span className="panel-label">FSS Phone Simulator</span>
            <div className="screw" />
          </div>

          <div className="lcd-display p-4 mb-4 text-center">
            <div className="lcd-text lcd-green text-2xl tracking-widest mb-1">FSS PHONE</div>
            <div className="lcd-text lcd-dim text-xs tracking-wider">IFR CLEARANCE DELIVERY — WEBRTC VOICE</div>
            <div className="lcd-text lcd-dim text-xs mt-2">VATSIM • ZLC ARTCC SALT LAKE CITY</div>
          </div>

          <BetaDisclaimer />

          {isLoading ? (
            <div className="lcd-display p-4 text-center">
              <span className="lcd-text lcd-dim text-sm">LOADING...</span>
            </div>
          ) : user ? (
            <>
              <div className="lcd-display p-3 mb-4 flex justify-between items-center">
                <div>
                  <span className="lcd-text lcd-green text-sm">{user.name.toUpperCase()}</span>
                  <span className="lcd-text lcd-dim text-xs ml-3">CID {user.cid} • {user.ratingShort}</span>
                </div>
                <button onClick={logout} className="hw-btn px-3 py-1 text-xs text-gray-400">
                  SIGN OUT
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <button onClick={() => navigate('/pilot')} className="hw-btn p-4 text-center">
                  <div className="lcd-text lcd-green text-lg mb-1">PILOT</div>
                  <div className="panel-label" style={{ fontSize: '8px' }}>CALL FSS CONTROLLERS</div>
                </button>
                <button onClick={() => navigate('/controller')} className="hw-btn-green hw-btn p-4 text-center">
                  <div className="lcd-text lcd-amber text-lg mb-1">CONTROLLER</div>
                  <div className="panel-label" style={{ fontSize: '8px' }}>ANSWER PILOT CALLS</div>
                </button>
              </div>
            </>
          ) : (
            <div className="text-center mb-4">
              <div className="lcd-display p-4 mb-3">
                <span className="lcd-text lcd-dim text-xs">SIGN IN WITH VATSIM TO BEGIN</span>
              </div>
              <button onClick={login} className="hw-btn-green hw-btn w-full p-3 text-sm text-green-200 tracking-wider">
                SIGN IN WITH VATSIM
              </button>
            </div>
          )}

          <div className="text-center mt-4 pt-3" style={{ borderTop: '1px solid var(--panel-edge)' }}>
            <span className="panel-label">ZLC ARTCC — SALT LAKE CITY</span>
            <div className="mt-1">
              <Link to="/privacy" className="panel-label" style={{ color: 'var(--lcd-dim)', fontSize: '8px' }}>PRIVACY POLICY</Link>
            </div>
          </div>

          <div className="flex justify-between mt-4">
            <div className="screw" />
            <div className="screw" />
          </div>
        </div>
      </div>
    </div>
  );
}
