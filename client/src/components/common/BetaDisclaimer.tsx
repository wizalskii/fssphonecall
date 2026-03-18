export default function BetaDisclaimer() {
  return (
    <div className="bg-red-600 text-white border-4 border-red-700 rounded-lg p-6 mb-6 shadow-lg">
      <div className="flex items-start gap-4">
        <svg
          className="w-8 h-8 flex-shrink-0 mt-1"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <div>
          <h3 className="text-2xl font-bold mb-2">BETA - TESTING ONLY</h3>
          <div className="space-y-2 text-sm">
            <p className="font-semibold">
              This is a BETA testing application and is NOT intended for actual VATSIM operations.
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Do NOT use this for real VATSIM flights or ATC sessions</li>
              <li>This is a training and testing tool only</li>
              <li>For official VATSIM communications, use approved channels</li>
              <li>Report bugs and issues on GitHub</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
