import { Shield, Lock, Eye, UserCheck, Mail, AlertCircle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import TopBar from '@/components/TopBar';

const PrivacyPolicyPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50">
      <TopBar />
      
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-pink-500 to-orange-500 rounded-full mb-6">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-pink-600 to-orange-600 bg-clip-text text-transparent mb-4">
            Privacy Policy
          </h1>
          <p className="text-gray-600 text-lg">
            Last Updated: October 22, 2025
          </p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 space-y-8">
          
          {/* Introduction */}
          <section>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Introduction</h2>
            <p className="text-gray-700 leading-relaxed">
              Welcome to HeartLink ("we," "our," or "us"). We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our dating application and services.
            </p>
            <p className="text-gray-700 leading-relaxed mt-4">
              By using HeartLink, you agree to the collection and use of information in accordance with this policy.
            </p>
          </section>

          {/* Information We Collect */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-pink-100 p-3 rounded-xl">
                <UserCheck className="w-6 h-6 text-pink-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">Information We Collect</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">1. Personal Information</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                  <li>Name, age, gender, and date of birth</li>
                  <li>Email address or phone number</li>
                  <li>Profile photos and bio</li>
                  <li>Location information (city, state)</li>
                  <li>Interests and preferences</li>
                  <li>Relationship preferences</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">2. Usage Information</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                  <li>Profile views and interactions (likes, matches)</li>
                  <li>Chat messages and communications</li>
                  <li>App usage patterns and preferences</li>
                  <li>Device information (device type, OS, IP address)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">3. Optional Information</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                  <li>Social media profile links (if provided)</li>
                  <li>Additional photos</li>
                  <li>Verification documents (for profile verification)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* How We Use Your Information */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-100 p-3 rounded-xl">
                <Eye className="w-6 h-6 text-orange-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">How We Use Your Information</h2>
            </div>
            
            <ul className="list-disc list-inside text-gray-700 space-y-3 ml-4">
              <li><strong>Matchmaking:</strong> To provide AI-powered match suggestions based on compatibility</li>
              <li><strong>Communication:</strong> To enable messaging between matched users</li>
              <li><strong>Profile Display:</strong> To show your profile to potential matches</li>
              <li><strong>Verification:</strong> To verify user profiles and maintain platform authenticity</li>
              <li><strong>Notifications:</strong> To send push notifications about matches, likes, and messages</li>
              <li><strong>Security:</strong> To detect and prevent fraudulent activities and policy violations</li>
              <li><strong>Improvement:</strong> To analyze and improve our services and user experience</li>
              <li><strong>Support:</strong> To respond to your inquiries and provide customer support</li>
            </ul>
          </section>

          {/* Data Sharing */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-purple-100 p-3 rounded-xl">
                <Lock className="w-6 h-6 text-purple-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">Data Sharing and Disclosure</h2>
            </div>
            
            <p className="text-gray-700 leading-relaxed mb-4">
              We do not sell your personal information. We may share your information in the following circumstances:
            </p>
            
            <ul className="list-disc list-inside text-gray-700 space-y-3 ml-4">
              <li><strong>With Other Users:</strong> Your profile information is visible to other users as per your privacy settings</li>
              <li><strong>Service Providers:</strong> With third-party services that help us operate our app (cloud storage, analytics)</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights and safety</li>
              <li><strong>Business Transfers:</strong> In case of merger, acquisition, or sale of assets</li>
            </ul>
          </section>

          {/* Your Privacy Rights */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-100 p-3 rounded-xl">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">Your Privacy Rights</h2>
            </div>
            
            <ul className="list-disc list-inside text-gray-700 space-y-3 ml-4">
              <li><strong>Access:</strong> Request access to your personal data</li>
              <li><strong>Correction:</strong> Update or correct your information</li>
              <li><strong>Deletion:</strong> Request deletion of your account and data</li>
              <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications</li>
              <li><strong>Privacy Controls:</strong> Manage who sees your profile through privacy settings</li>
              <li><strong>Download:</strong> Request a copy of your data</li>
            </ul>
          </section>

          {/* Data Security */}
          <section>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Data Security</h2>
            <p className="text-gray-700 leading-relaxed">
              We implement industry-standard security measures to protect your information:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4 mt-4">
              <li>Encrypted data transmission (SSL/TLS)</li>
              <li>Secure password hashing</li>
              <li>Regular security audits</li>
              <li>Access controls and authentication</li>
              <li>Secure cloud storage</li>
            </ul>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Data Retention</h2>
            <p className="text-gray-700 leading-relaxed">
              We retain your information as long as your account is active or as needed to provide services. You can request account deletion at any time, and we will delete your data within 30 days, except where required by law.
            </p>
          </section>

          {/* Children's Privacy */}
          <section>
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Children's Privacy</h2>
                  <p className="text-gray-700 leading-relaxed">
                    HeartLink is intended for users aged 18 and above. We do not knowingly collect information from children under 18. If you believe we have collected information from a minor, please contact us immediately.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Changes to Policy */}
          <section>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Changes to This Policy</h2>
            <p className="text-gray-700 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last Updated" date. Continued use of HeartLink after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          {/* Contact Us */}
          <section className="bg-gradient-to-br from-pink-50 to-orange-50 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-white p-3 rounded-xl shadow-md">
                <Mail className="w-6 h-6 text-pink-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">Contact Us</h2>
            </div>
            
            <p className="text-gray-700 leading-relaxed mb-4">
              If you have any questions about this Privacy Policy or our data practices, please contact us:
            </p>
            
            <div className="space-y-2 text-gray-700">
              <p><strong>Email:</strong> help@heartlink.co.in</p>
              <p><strong>Website:</strong> heartlink.co.in</p>
              <p><strong>Response Time:</strong> We aim to respond within 24-48 hours</p>
            </div>
          </section>

          {/* Footer Note */}
          <div className="text-center pt-8 border-t-2 border-gray-200">
            <p className="text-gray-600 text-sm">
              By using HeartLink, you acknowledge that you have read and understood this Privacy Policy.
            </p>
            <p className="text-gray-500 text-sm mt-2">
              © 2025 HeartLink. All rights reserved.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
