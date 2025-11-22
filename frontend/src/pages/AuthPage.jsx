import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { Heart, Mail, Lock, User, Phone, MapPin, Calendar } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';

// Use environment variable only - no fallback
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
if (!BACKEND_URL) {
  console.error('⚠️ REACT_APP_BACKEND_URL is not set!');
}
const API = `${BACKEND_URL}/api`;
