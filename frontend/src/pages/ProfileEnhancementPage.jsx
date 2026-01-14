import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  ArrowLeft, Heart, Star, Mic, Video, Save,
  Sparkles, User, Check, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import Navbar from '@/components/Navbar';
import TopBar from '@/components/TopBar';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/firebase/config';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Constants
const VALUES_OPTIONS = [
  { id: 'respect', label: 'Respect', icon: '🤝' },
  { id: 'family', label: 'Family', icon: '👨‍👩‍👧‍👦' },
  { id: 'ambition', label: 'Ambition', icon: '🚀' },
  { id: 'spirituality', label: 'Spirituality', icon: '🙏' },
  { id: 'freedom', label: 'Freedom', icon: '🦅' }
];

const RELATIONSHIP_INTENTS = [
  { id: 'serious', label: 'Serious Relationship', icon: '💍' },
  { id: 'casual', label: 'Casual Dating', icon: '🌸' },
  { id: 'friendship', label: 'Friendship First', icon: '🤗' },
  { id: 'marriage', label: 'Marriage', icon: '💒' }
];

const LIFESTYLE_TAGS = [
  { id: 'non-smoker', label: 'Non-Smoker', icon: '🚭' },
  { id: 'vegetarian', label: 'Vegetarian', icon: '🥗' },
  { id: 'fitness', label: 'Fitness', icon: '💪' },
  { id: 'travel', label: 'Travel', icon: '✈️' },
  { id: 'night-owl', label: 'Night Owl', icon: '🦉' },
  { id: 'early-bird', label: 'Early Bird', icon: '🐦' },
  { id: 'pet-lover', label: 'Pet Lover', icon: '🐶' },
  { id: 'foodie', label: 'Foodie', icon: '🍕' }
];

const ProfileEnhancementPage = ({ user, onUpdate }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  
  // Form state
  const [aboutMe, setAboutMe] = useState('');
  const [selectedValues, setSelectedValues] = useState([]);
  const [relationshipIntent, setRelationshipIntent] = useState('');
  const [selectedLifestyle, setSelectedLifestyle] = useState([]);
  const [voiceIntroUrl, setVoiceIntroUrl] = useState('');
  const [videoIntroUrl, setVideoIntroUrl] = useState('');
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (user?.id) {
      fetchProfile();
    }
  }, [user?.id]);

  const fetchProfile = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const response = await axios.get(`${API}/profile/${user.id}`);
      const data = response.data;
      setProfile(data);
      
      setAboutMe(data.about_me || '');
      setSelectedValues(data.values || []);
      setRelationshipIntent(data.relationship_intent || '');
      setSelectedLifestyle(data.lifestyle_tags || []);
      setVoiceIntroUrl(data.bio_voice_intro_url || '');
      setVideoIntroUrl(data.intro_video_url || '');
    } catch (error) {
      console.error('Profile enhancement load error:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const toggleValue = (valueId) => {
    setSelectedValues(prev => 
      prev.includes(valueId) 
        ? prev.filter(v => v !== valueId)
        : [...prev, valueId]
    );
  };

  const toggleLifestyle = (tagId) => {
    setSelectedLifestyle(prev => 
      prev.includes(tagId) 
        ? prev.filter(t => t !== tagId)
        : [...prev, tagId]
    );
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await uploadVoiceIntro(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 15) {
            stopVoiceRecording();
            return 15;
          }
          return prev + 1;
        });
      }, 1000);
      
    } catch (error) {
      toast.error('Could not access microphone');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const uploadVoiceIntro = async (audioBlob) => {
    setSaving(true);
    try {
      const fileName = `voice_intro_${user.id}_${Date.now()}.webm`;
      const storageRef = ref(storage, `voice_intros/${fileName}`);
      await uploadBytes(storageRef, audioBlob);
      const downloadURL = await getDownloadURL(storageRef);
      setVoiceIntroUrl(downloadURL);
      toast.success('Voice intro recorded!');
    } catch (error) {
      toast.error('Failed to upload voice intro');
    } finally {
      setSaving(false);
    }
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      toast.error('Video must be less than 50MB');
      return;
    }
    
    setSaving(true);
    try {
      const fileName = `video_intro_${user.id}_${Date.now()}_${file.name}`;
      const storageRef = ref(storage, `video_intros/${fileName}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      setVideoIntroUrl(downloadURL);
      toast.success('Video intro uploaded!');
    } catch (error) {
      toast.error('Failed to upload video');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = {
        about_me: aboutMe,
        values: selectedValues,
        relationship_intent: relationshipIntent,
        lifestyle_tags: selectedLifestyle,
        bio_voice_intro_url: voiceIntroUrl || null,
        intro_video_url: videoIntroUrl || null
      };
      
      const response = await axios.put(`${API}/user/${user.id}/profile-enhancement`, updates);
      
      if (onUpdate) {
        onUpdate(response.data);
      }
      localStorage.setItem('user', JSON.stringify(response.data));
      
      toast.success('Profile updated successfully!');
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to save changes';
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 pb-20 sm:pb-24" style={{ paddingTop: '95px' }}>
      <TopBar />
      <Toaster position="top-center" />
      <Navbar user={user} />
      
      <div className="max-w-3xl mx-auto px-4 pb-24 sm:pb-28">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/50 rounded-full transition-all"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Enhance Profile</h1>
            <p className="text-gray-600">Tell people more about yourself</p>
          </div>
        </div>

        <div className="space-y-6">
          
          {/* About Me */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-pink-500" />
              About Me
            </h3>
            <textarea
              value={aboutMe}
              onChange={(e) => setAboutMe(e.target.value)}
              placeholder="Share your story... What makes you unique? What are you passionate about?"
              className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none h-32"
              maxLength={500}
              data-testid="about-me-input"
            />
            <p className="text-sm text-gray-400 mt-2 text-right">{aboutMe.length}/500</p>
          </div>

          {/* Relationship Intent */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-pink-500" />
              Relationship Intent
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {RELATIONSHIP_INTENTS.map(intent => (
                <button
                  key={intent.id}
                  onClick={() => setRelationshipIntent(intent.id)}
                  className={`p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                    relationshipIntent === intent.id
                      ? 'border-pink-500 bg-pink-50 shadow-md'
                      : 'border-gray-200 hover:border-pink-300'
                  }`}
                  data-testid={`intent-${intent.id}`}
                >
                  <span className="text-2xl">{intent.icon}</span>
                  <span className="font-medium text-gray-800">{intent.label}</span>
                  {relationshipIntent === intent.id && (
                    <Check className="w-5 h-5 text-pink-500 ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Values */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              My Values
            </h3>
            <div className="flex flex-wrap gap-3">
              {VALUES_OPTIONS.map(value => (
                <button
                  key={value.id}
                  onClick={() => toggleValue(value.id)}
                  className={`px-4 py-3 rounded-full border-2 transition-all flex items-center gap-2 ${
                    selectedValues.includes(value.id)
                      ? 'border-yellow-500 bg-yellow-50 shadow-md'
                      : 'border-gray-200 hover:border-yellow-300'
                  }`}
                  data-testid={`value-${value.id}`}
                >
                  <span>{value.icon}</span>
                  <span className="font-medium">{value.label}</span>
                  {selectedValues.includes(value.id) && (
                    <Check className="w-4 h-4 text-yellow-600" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Lifestyle Tags */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Lifestyle
            </h3>
            <div className="flex flex-wrap gap-3">
              {LIFESTYLE_TAGS.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => toggleLifestyle(tag.id)}
                  className={`px-4 py-3 rounded-full border-2 transition-all flex items-center gap-2 ${
                    selectedLifestyle.includes(tag.id)
                      ? 'border-purple-500 bg-purple-50 shadow-md'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                  data-testid={`lifestyle-${tag.id}`}
                >
                  <span>{tag.icon}</span>
                  <span className="font-medium">{tag.label}</span>
                  {selectedLifestyle.includes(tag.id) && (
                    <Check className="w-4 h-4 text-purple-600" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Voice Intro */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Mic className="w-5 h-5 text-blue-500" />
              Voice Intro (15 sec)
            </h3>
            
            {voiceIntroUrl ? (
              <div className="bg-blue-50 rounded-xl p-4 flex items-center justify-between">
                <audio src={voiceIntroUrl} controls className="flex-1" />
                <button
                  onClick={() => setVoiceIntroUrl('')}
                  className="ml-4 p-2 text-red-500 hover:bg-red-50 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {isRecording ? (
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto bg-red-500 rounded-full flex items-center justify-center animate-pulse mb-4">
                      <Mic className="w-10 h-10 text-white" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{recordingTime}s / 15s</p>
                    <Button
                      onClick={stopVoiceRecording}
                      variant="destructive"
                      className="mt-4"
                    >
                      Stop Recording
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={startVoiceRecording}
                    className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-4 rounded-xl"
                    data-testid="record-voice-btn"
                  >
                    <Mic className="w-5 h-5 mr-2" />
                    Record Voice Intro
                  </Button>
                )}
                <p className="text-sm text-gray-500 text-center">
                  Record a short voice intro to make your profile stand out!
                </p>
              </div>
            )}
          </div>

          {/* Video Intro */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Video className="w-5 h-5 text-green-500" />
              Video Intro (Optional)
            </h3>
            
            {videoIntroUrl ? (
              <div className="bg-green-50 rounded-xl p-4">
                <video src={videoIntroUrl} controls className="w-full rounded-lg" />
                <button
                  onClick={() => setVideoIntroUrl('')}
                  className="mt-2 w-full py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium"
                >
                  Remove Video
                </button>
              </div>
            ) : (
              <div>
                <label className="block w-full cursor-pointer">
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-green-500 transition-all">
                    <Video className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">Click to upload video</p>
                    <p className="text-sm text-gray-400 mt-1">Max 50MB, MP4/WebM</p>
                  </div>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleVideoUpload}
                    className="hidden"
                    data-testid="video-upload-input"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-gradient-to-r from-pink-500 to-orange-500 text-white py-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
            data-testid="save-profile-btn"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Saving...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Save className="w-5 h-5" />
                Save Changes
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProfileEnhancementPage;
