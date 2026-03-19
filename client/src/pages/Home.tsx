import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import BetaDisclaimer from '../components/common/BetaDisclaimer';

export default function Home() {
  const navigate = useNavigate();
  const { user, isLoading, login, logout } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-gray-100">
      <Card className="max-w-3xl w-full">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-8 mb-6">
            <img
              src="/vatsim-logo.png"
              alt="VATSIM"
              className="h-16 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="text-3xl text-gray-300">|</div>
            <img
              src="/zlc-logo.png"
              alt="ZLC ARTCC"
              className="h-16 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-4xl font-bold text-center mb-2">FSS Phone Simulator</h1>
          <p className="text-center text-gray-600 mb-2">IFR Clearance Delivery via WebRTC Voice</p>
          <p className="text-sm text-gray-500">VATSIM • ZLC ARTCC Salt Lake City</p>
        </div>

        <BetaDisclaimer />

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : user ? (
          <>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 flex items-center justify-between">
              <div>
                <p className="font-semibold">{user.name}</p>
                <p className="text-sm text-gray-600">CID {user.cid} &middot; {user.ratingShort}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={logout}>
                Sign Out
              </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="border-2 border-blue-200 rounded-lg p-6 hover:border-blue-400 transition-colors">
                <h2 className="text-2xl font-semibold mb-3">Pilot</h2>
                <p className="text-gray-600 mb-4">
                  Call FSS controllers to request IFR clearance delivery for your flight.
                </p>
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={() => navigate('/pilot')}
                >
                  Enter as Pilot
                </Button>
              </div>

              <div className="border-2 border-green-200 rounded-lg p-6 hover:border-green-400 transition-colors">
                <h2 className="text-2xl font-semibold mb-3">Controller</h2>
                <p className="text-gray-600 mb-4">
                  Go online as an FSS controller and answer calls from pilots requesting clearances.
                </p>
                <Button
                  variant="success"
                  size="lg"
                  className="w-full"
                  onClick={() => navigate('/controller')}
                >
                  Enter as Controller
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 mb-8">
            <p className="text-gray-600 mb-4">Sign in with your VATSIM account to get started.</p>
            <Button variant="primary" size="lg" onClick={login}>
              Sign in with VATSIM
            </Button>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-2">How it works:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
            <li>Sign in with your VATSIM account</li>
            <li>Controllers go online with their callsign and frequency</li>
            <li>Pilots see available controllers and select one to call</li>
            <li>Real voice communication via WebRTC when call is answered</li>
          </ol>
        </div>

        <div className="text-center text-sm text-gray-500 border-t pt-4">
          <p className="font-semibold mb-1">ZLC ARTCC - Salt Lake City ARTCC</p>
          <p>VATSIM Training & Testing Tool</p>
          <p className="mt-2 text-xs">Not affiliated with or endorsed by official VATSIM operations</p>
          <p className="mt-3">
            <Link to="/privacy" className="text-blue-600 hover:underline text-xs">Privacy Policy</Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
