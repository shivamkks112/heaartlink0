import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, CheckCircle, XCircle, Loader2, ArrowLeft, Shield, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { API } from '@/config/api';
import axios from 'axios';
import TopBar from '@/components/TopBar';
import Navbar from '@/components/Navbar';

const SelfieVerificationPage = ({ user }) => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [step, setStep] = useState('intro'); // intro, camera, preview, submitting, result
  const [selfieData, setSelfieData] = useState(null);
  const [stream, setStream] = useState(null);
  const [result, setResult] = useState(null);
  const [facingMode, setFacingMode] = useState('user');

  const startCamera = useCallback(async () => {
    try {
      setStep('camera'); // Show camera UI immediately
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode, 
          width: { ideal: 480, max: 640 }, 
          height: { ideal: 360, max: 480 },
          frameRate: { ideal: 30 }
        },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(() => {});
      }
      setStream(mediaStream);
    } catch (err) {
      toast.error('Camera access denied. Please allow camera permission.');
      setStep('intro');
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    // Mirror for selfie camera
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setSelfieData(dataUrl);
    stopCamera();
    setStep('preview');
  }, [stopCamera]);

  const retake = useCallback(() => {
    setSelfieData(null);
    setResult(null);
    startCamera();
  }, [startCamera]);

  const submitSelfie = async () => {
    if (!selfieData || !user?.id) return;
    setStep('submitting');
    try {
      const res = await axios.post(`${API}/user/verify-selfie-ai`, {
        user_id: user.id,
        selfie_base64: selfieData,
      });
      setResult(res.data);
      setStep('result');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Verification failed. Try again.';
      toast.error(msg);
      setStep('preview');
    }
  };

  // Cleanup on unmount
  const cleanup = () => { stopCamera(); };

  const profilePhoto = user?.profile_picture || (user?.photos && user.photos[0]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 page-with-bottom-nav">
      <TopBar />
      <Navbar user={user} />
      <canvas ref={canvasRef} className="hidden" />

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Back */}
        <button onClick={() => { cleanup(); navigate(-1); }} className="flex items-center gap-2 text-gray-600 mb-4">
          <ArrowLeft className="w-5 h-5" /> <span className="text-sm font-medium">Back</span>
        </button>

        {/* ── INTRO ── */}
        {step === 'intro' && (
          <div className="space-y-6" data-testid="selfie-intro">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-blue-100 flex items-center justify-center mb-3">
                <Shield className="w-8 h-8 text-blue-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Get Verified</h1>
              <p className="text-sm text-gray-500 mt-1">Take a selfie to verify your identity</p>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sm font-bold text-green-600">1</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Take a clear selfie</p>
                  <p className="text-xs text-gray-500">Good lighting, face clearly visible</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sm font-bold text-blue-600">2</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">AI compares with profile photo</p>
                  <p className="text-xs text-gray-500">Instant face match verification</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sm font-bold text-purple-600">3</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Get your Verified badge</p>
                  <p className="text-xs text-gray-500">Verified profiles get more matches</p>
                </div>
              </div>
            </div>

            {/* Profile photo preview */}
            {profilePhoto && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs text-gray-500 mb-2 font-medium">Your Profile Photo</p>
                <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-gray-200">
                  <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                </div>
              </div>
            )}

            <Button
              onClick={startCamera}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 rounded-xl font-semibold"
              data-testid="start-camera-btn"
            >
              <Camera className="w-5 h-5 mr-2" /> Open Camera
            </Button>
          </div>
        )}

        {/* ── CAMERA ── */}
        {step === 'camera' && (
          <div className="space-y-4" data-testid="selfie-camera">
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
              {/* Face guide overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-60 border-2 border-white/50 rounded-[50%]" />
              </div>
              <p className="absolute bottom-4 left-0 right-0 text-center text-white text-xs bg-black/40 py-1.5">
                Position your face inside the oval
              </p>
            </div>

            <div className="flex gap-3">
              <Button onClick={() => { stopCamera(); setStep('intro'); }} variant="outline" className="flex-1 py-3">
                Cancel
              </Button>
              <Button
                onClick={capturePhoto}
                className="flex-1 bg-gradient-to-r from-pink-500 to-rose-500 text-white py-3"
                data-testid="capture-btn"
              >
                <Camera className="w-5 h-5 mr-2" /> Capture
              </Button>
            </div>
          </div>
        )}

        {/* ── PREVIEW ── */}
        {step === 'preview' && selfieData && (
          <div className="space-y-4" data-testid="selfie-preview">
            <h2 className="text-lg font-bold text-gray-900 text-center">Review your selfie</h2>

            <div className="flex gap-3 items-start">
              {profilePhoto && (
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1.5 text-center font-medium">Profile</p>
                  <div className="aspect-square rounded-xl overflow-hidden border-2 border-gray-200">
                    <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                  </div>
                </div>
              )}
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-1.5 text-center font-medium">Selfie</p>
                <div className="aspect-square rounded-xl overflow-hidden border-2 border-blue-300">
                  <img src={selfieData} alt="Selfie" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={retake} variant="outline" className="flex-1 py-3">
                <RotateCcw className="w-4 h-4 mr-2" /> Retake
              </Button>
              <Button
                onClick={submitSelfie}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3"
                data-testid="submit-selfie-btn"
              >
                <Shield className="w-4 h-4 mr-2" /> Verify
              </Button>
            </div>
          </div>
        )}

        {/* ── SUBMITTING ── */}
        {step === 'submitting' && (
          <div className="text-center py-16 space-y-4" data-testid="selfie-submitting">
            <Loader2 className="w-12 h-12 mx-auto text-blue-500 animate-spin" />
            <h2 className="text-lg font-bold text-gray-900">Verifying your identity...</h2>
            <p className="text-sm text-gray-500">AI is comparing your selfie with profile photo</p>
          </div>
        )}

        {/* ── RESULT ── */}
        {step === 'result' && result && (
          <div className="text-center py-10 space-y-5" data-testid="selfie-result">
            {result.status === 'verified' ? (
              <>
                <div className="w-20 h-20 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-green-700">Verified!</h2>
                <p className="text-sm text-gray-600">{result.message}</p>
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 inline-block">
                  <p className="text-xs text-green-700 font-medium">Verified badge is now active on your profile</p>
                </div>
              </>
            ) : result.status === 'pending' ? (
              <>
                <div className="w-20 h-20 mx-auto rounded-full bg-yellow-100 flex items-center justify-center">
                  <Shield className="w-10 h-10 text-yellow-600" />
                </div>
                <h2 className="text-xl font-bold text-yellow-700">Under Review</h2>
                <p className="text-sm text-gray-600">{result.message}</p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle className="w-10 h-10 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-red-700">Not Matched</h2>
                <p className="text-sm text-gray-600">{result.message}</p>
                <Button onClick={retake} variant="outline" className="mt-2">
                  <RotateCcw className="w-4 h-4 mr-2" /> Try Again
                </Button>
              </>
            )}

            <Button
              onClick={() => navigate('/profile')}
              className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white py-3 rounded-xl mt-4"
            >
              Go to Profile
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SelfieVerificationPage;
