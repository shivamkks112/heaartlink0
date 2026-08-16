import { useState, useEffect } from 'react';
import { Gamepad2, Trophy, X, ArrowRight, CheckCircle, Heart } from 'lucide-react';
import axios from 'axios';
import { API } from '@/config/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

const PlayWithMatch = ({ matchId, userId, otherUserName, onClose }) => {
  const [view, setView] = useState('menu'); // menu, game_select, playing, waiting, result
  const [gameType, setGameType] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const createGame = async (type) => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/game/create?match_id=${matchId}&game_type=${type}&sender_id=${userId}`);
      setGameId(res.data.game_id);
      toast.success(`Game invitation sent to ${otherUserName}!`);
      setView('waiting');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to create game';
      toast.error(msg);
    }
    setLoading(false);
  };

  const acceptGame = async (gId) => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/game/${gId}/respond?user_id=${userId}&action=accept`);
      setQuestions(res.data.questions || []);
      setGameId(gId);
      setView('playing');
    } catch (err) {
      toast.error('Failed to accept game');
    }
    setLoading(false);
  };

  const selectAnswer = (qId, option) => {
    setAnswers(prev => ({ ...prev, [qId]: option }));
  };

  const nextQuestion = () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
    }
  };

  const submitAnswers = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/game/${gameId}/answer?user_id=${userId}`, answers);
      if (res.data.status === 'completed') {
        setResult({ score: res.data.score, message: res.data.result_message });
        setView('result');
      } else {
        setView('waiting');
        toast.success('Answers submitted! Waiting for partner...');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit');
    }
    setLoading(false);
  };

  // Game Menu
  if (view === 'menu') {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-lg max-w-sm mx-auto" data-testid="play-together-menu">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--m3-on-surface)' }}>
            <Gamepad2 className="w-5 h-5 text-purple-500" /> Play Together
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <button
            data-testid="match-quiz-btn"
            onClick={() => createGame('match_quiz')}
            disabled={loading}
            className="w-full p-4 rounded-xl text-left transition-all active:scale-[0.98] border"
            style={{ background: 'linear-gradient(135deg, #FDF2F8, #FFF1F2)', borderColor: '#FBCFE8' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                <Heart className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-gray-900">Match Quiz</p>
                <p className="text-xs text-gray-500">See how well you match</p>
              </div>
            </div>
          </button>
          <button
            data-testid="compatibility-btn"
            onClick={() => createGame('compatibility_challenge')}
            disabled={loading}
            className="w-full p-4 rounded-xl text-left transition-all active:scale-[0.98] border"
            style={{ background: 'linear-gradient(135deg, #F0F9FF, #EFF6FF)', borderColor: '#BFDBFE' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-gray-900">Compatibility Challenge</p>
                <p className="text-xs text-gray-500">Compare your preferences</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // Waiting for partner
  if (view === 'waiting') {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg max-w-sm mx-auto text-center" data-testid="game-waiting">
        <div className="w-16 h-16 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center animate-pulse">
          <Gamepad2 className="w-8 h-8 text-purple-500" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Waiting for {otherUserName}...</h3>
        <p className="text-sm text-gray-500 mb-4">They'll receive a notification. You can continue chatting!</p>
        <Button onClick={onClose} className="bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl px-6">
          Continue Chat
        </Button>
      </div>
    );
  }

  // Playing
  if (view === 'playing' && questions.length > 0) {
    const q = questions[currentQ];
    const isLastQ = currentQ === questions.length - 1;
    const answered = answers[q.id];

    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-lg max-w-sm mx-auto" data-testid="game-playing">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-purple-500 bg-purple-50 px-3 py-1 rounded-full">
            {currentQ + 1} / {questions.length}
          </span>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        {/* Progress */}
        <div className="w-full h-1.5 bg-gray-100 rounded-full mb-5">
          <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all" style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} />
        </div>
        <h3 className="text-base font-bold text-gray-900 mb-4">{q.question}</h3>
        <div className="space-y-2.5">
          {q.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => selectAnswer(q.id, opt)}
              data-testid={`option-${i}`}
              className={`w-full p-3.5 rounded-xl text-left text-sm font-medium transition-all active:scale-[0.98] border ${
                answered === opt
                  ? 'bg-purple-500 text-white border-purple-500 shadow-lg shadow-purple-200'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-purple-300'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        {answered && (
          <div className="mt-4">
            {isLastQ ? (
              <Button
                onClick={submitAnswers}
                disabled={loading}
                data-testid="submit-answers-btn"
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl py-3 font-bold"
              >
                {loading ? 'Submitting...' : 'Submit Answers'}
              </Button>
            ) : (
              <Button
                onClick={nextQuestion}
                data-testid="next-question-btn"
                className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl py-3 font-bold flex items-center justify-center gap-2"
              >
                Next <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Result
  if (view === 'result' && result) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg max-w-sm mx-auto text-center" data-testid="game-result">
        <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center">
          <Trophy className="w-10 h-10 text-white" />
        </div>
        <h3 className="text-sm text-gray-500 mb-1">You & {otherUserName}</h3>
        <div className="text-5xl font-black bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent mb-2">
          {result.score}%
        </div>
        <p className="text-base font-semibold text-gray-900 mb-1">Compatibility</p>
        <p className="text-sm text-gray-500 mb-6">{result.message}</p>
        <div className="space-y-2.5">
          <Button onClick={onClose} data-testid="continue-chat-btn" className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl py-3 font-bold">
            Continue Chat
          </Button>
          <Button onClick={() => { setView('menu'); setCurrentQ(0); setAnswers({}); setResult(null); setGameId(null); }} variant="outline" className="w-full rounded-xl py-3">
            Play Again
          </Button>
        </div>
      </div>
    );
  }

  return null;
};

// Game Invite Message Bubble Component
export const GameInviteBubble = ({ gameId, gameType, isOwn, userId, otherUserName, onAccept }) => {
  const [status, setStatus] = useState('pending');
  const label = gameType === 'match_quiz' ? 'Match Quiz' : 'Compatibility Challenge';

  const handleAccept = async () => {
    try {
      const res = await axios.post(`${API}/game/${gameId}/respond?user_id=${userId}&action=accept`);
      setStatus('accepted');
      if (onAccept) onAccept(gameId, res.data.questions);
    } catch (err) {
      toast.error('Failed to accept');
    }
  };

  const handleDecline = async () => {
    try {
      await axios.post(`${API}/game/${gameId}/respond?user_id=${userId}&action=decline`);
      setStatus('declined');
    } catch (err) {
      toast.error('Failed to decline');
    }
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 rounded-2xl p-4 max-w-[260px] border border-purple-200 dark:border-purple-700" data-testid="game-invite-bubble">
      <div className="flex items-center gap-2 mb-2">
        <Gamepad2 className="w-4 h-4 text-purple-500" />
        <span className="text-xs font-bold text-purple-600">{label}</span>
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
        {isOwn ? `You invited ${otherUserName}` : `${otherUserName} invited you`}
      </p>
      {!isOwn && status === 'pending' && (
        <div className="flex gap-2">
          <button onClick={handleAccept} className="flex-1 py-2 bg-purple-500 text-white text-xs font-bold rounded-lg" data-testid="accept-game-btn">Accept</button>
          <button onClick={handleDecline} className="flex-1 py-2 bg-gray-200 text-gray-700 text-xs font-bold rounded-lg" data-testid="decline-game-btn">Decline</button>
        </div>
      )}
      {status === 'accepted' && <p className="text-xs text-green-600 font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Accepted!</p>}
      {status === 'declined' && <p className="text-xs text-gray-400">Declined</p>}
      {isOwn && status === 'pending' && <p className="text-xs text-purple-500 animate-pulse">Waiting for response...</p>}
    </div>
  );
};

export default PlayWithMatch;
