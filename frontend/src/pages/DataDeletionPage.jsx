import { Trash2, Mail, Shield, AlertCircle, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import Navbar from '@/components/Navbar';
import TopBar from '@/components/TopBar';

const DataDeletionPage = () => {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50">
      <TopBar />
      
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-red-500 to-orange-500 rounded-full mb-6">
            <Trash2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent mb-4">
            Delete Account & Data
          </h1>
          <p className="text-gray-600 text-lg">
            Request permanent deletion of your HeartLink account and associated data
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12">
          
          {!submitted ? (
            <>
              {/* Warning Box */}
              <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-6 mb-8">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-xl font-bold text-red-900 mb-2">⚠️ Warning: Permanent Action</h3>
                    <p className="text-red-800 leading-relaxed">
                      Deleting your account is <strong>permanent and irreversible</strong>. All your data including profile, matches, messages, and photos will be permanently deleted from our servers.
                    </p>
                  </div>
                </div>
              </div>

              {/* What Will Be Deleted */}
              <section className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">What Will Be Deleted:</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">Profile Information</h3>
                    <ul className="text-gray-700 space-y-1 text-sm">
                      <li>• Name and bio</li>
                      <li>• Profile photos</li>
                      <li>• Interests and preferences</li>
                      <li>• Location data</li>
                    </ul>
                  </div>
                  
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">Activity Data</h3>
                    <ul className="text-gray-700 space-y-1 text-sm">
                      <li>• Match history</li>
                      <li>• Chat messages</li>
                      <li>• Likes and interactions</li>
                      <li>• Account settings</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Deletion Methods */}
              <section className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">How to Delete Your Account:</h2>
                
                {/* Method 1: In-App */}
                <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">1</div>
                    <div>
                      <h3 className="text-xl font-bold text-blue-900 mb-2">Delete from App (Recommended)</h3>
                      <p className="text-blue-800 leading-relaxed mb-3">
                        The fastest way to delete your account:
                      </p>
                      <ol className="text-blue-900 space-y-2 ml-4">
                        <li>1. Open HeartLink app</li>
                        <li>2. Go to <strong>Profile</strong> → <strong>Settings</strong></li>
                        <li>3. Scroll to bottom → Click <strong>"Delete Account"</strong></li>
                        <li>4. Confirm deletion → Account deleted immediately</li>
                      </ol>
                    </div>
                  </div>
                </div>

                {/* Method 2: Email Request */}
                <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-6">
                  <div className="flex items-start gap-3">
                    <div className="bg-orange-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">2</div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-orange-900 mb-2">Request via Email</h3>
                      <p className="text-orange-800 leading-relaxed mb-4">
                        Send us an email with your account details:
                      </p>
                      
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Your Email (used for HeartLink account)
                          </label>
                          <input
                            type="email"
                            required
                            className="w-full px-4 py-3 border-2 border-orange-200 rounded-xl focus:border-orange-500 focus:outline-none"
                            placeholder="your.email@example.com"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Reason for Deletion (Optional)
                          </label>
                          <textarea
                            className="w-full px-4 py-3 border-2 border-orange-200 rounded-xl focus:border-orange-500 focus:outline-none"
                            rows="3"
                            placeholder="Help us improve by sharing why you're leaving..."
                          ></textarea>
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white py-4 rounded-xl font-bold text-lg hover:shadow-xl transition-all"
                        >
                          Submit Deletion Request
                        </button>
                      </form>

                      <div className="mt-4 p-4 bg-white rounded-lg">
                        <p className="text-sm text-gray-600">
                          <strong>Or email directly:</strong>
                        </p>
                        <a href="mailto:help@heartlink.co.in?subject=Account Deletion Request" className="text-orange-600 font-semibold hover:underline">
                          help@heartlink.co.in
                        </a>
                        <p className="text-xs text-gray-500 mt-2">
                          Subject: "Account Deletion Request"<br/>
                          Include: Your registered email address
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Timeline */}
              <section className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Deletion Timeline:</h2>
                <div className="bg-purple-50 rounded-2xl p-6">
                  <ul className="space-y-3 text-gray-700">
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-1" />
                      <span><strong>In-App Deletion:</strong> Immediate (within seconds)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-1" />
                      <span><strong>Email Request:</strong> Processed within 24-48 hours</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-1" />
                      <span><strong>Complete Data Removal:</strong> All data permanently deleted from servers within 30 days</span>
                    </li>
                  </ul>
                </div>
              </section>

              {/* Important Notes */}
              <section>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Important Notes:</h2>
                <ul className="space-y-2 text-gray-700 ml-4">
                  <li>• Account deletion cannot be undone</li>
                  <li>• You will need to create a new account if you want to use HeartLink again</li>
                  <li>• Your matches will no longer see your profile</li>
                  <li>• All conversations will be permanently deleted</li>
                  <li>• Legal retention: Some data may be retained for legal compliance (30 days max)</li>
                </ul>
              </section>

            </>
          ) : (
            // Success Message
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full mb-6">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Request Submitted Successfully!</h2>
              <p className="text-xl text-gray-600 mb-8">
                We've received your account deletion request.
              </p>
              <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-6 max-w-2xl mx-auto">
                <p className="text-green-800 leading-relaxed">
                  <strong>What happens next?</strong><br/>
                  Our team will process your request within <strong>24-48 hours</strong>. You'll receive a confirmation email at your registered email address once your account and all associated data have been permanently deleted.
                </p>
              </div>
              <div className="mt-8">
                <a href="/" className="text-pink-600 font-semibold hover:underline">
                  ← Back to Home
                </a>
              </div>
            </div>
          )}

          {/* Contact Section */}
          {!submitted && (
            <div className="mt-12 pt-8 border-t-2 border-gray-200">
              <div className="bg-gradient-to-br from-pink-50 to-orange-50 rounded-2xl p-8 text-center">
                <Mail className="w-8 h-8 text-pink-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Need Help?</h3>
                <p className="text-gray-700 mb-4">
                  If you have questions about account deletion or data privacy:
                </p>
                <a 
                  href="mailto:help@heartlink.co.in" 
                  className="text-pink-600 font-bold text-lg hover:underline"
                >
                  help@heartlink.co.in
                </a>
                <p className="text-sm text-gray-600 mt-4">
                  Response time: 24-48 hours
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default DataDeletionPage;
