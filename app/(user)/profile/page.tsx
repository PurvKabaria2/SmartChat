"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Camera,
  Check,
  X,
  Mail,
  Calendar,
  User,
  Shield,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  ArrowLeft,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { testTextToSpeech } from "@/functions/ttsUtils";
import SignOutButton from "@/components/SignOutButton";
import { auth, getUserProfile, updateUserProfile } from "@/lib/firebase";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";

type UserProfile = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  address: string | null;
  gender: string | null;
  tts_enabled?: boolean;
  stt_enabled?: boolean;
  created_at?: string;
};

export default function ProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");
  const [gender, setGender] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [sttEnabled, setSttEnabled] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (!user) {
            router.push("/login?message=Please log in to view your profile");
            return;
          }

          try {
            const profileData = await getUserProfile(user.uid);

            if (!profileData) {
              console.log("No profile found for user, creating basic one");

              const userProfile: UserProfile = {
                id: user.uid,
                email: user.email || "",
                first_name: user.displayName?.split(" ")[0] || "",
                last_name:
                  user.displayName?.split(" ").slice(1).join(" ") || "",
                avatar_url: user.photoURL || null,
                address: null,
                gender: null,
                tts_enabled: false,
                stt_enabled: false,
                created_at: user.metadata.creationTime,
              };

              await updateUserProfile(user.uid, {
                email: userProfile.email,
                first_name: userProfile.first_name,
                last_name: userProfile.last_name,
                avatar_url: userProfile.avatar_url,
                updated_at: new Date().toISOString(),
              });

              setProfile(userProfile);
              setFirstName(userProfile.first_name);
              setLastName(userProfile.last_name);
              setAvatarUrl(
                userProfile.avatar_url !== undefined
                  ? userProfile.avatar_url
                  : null
              );
            } else {
              const userProfile: UserProfile = {
                id: user.uid,
                email: user.email || "",
                first_name: profileData.first_name || "",
                last_name: profileData.last_name || "",
                avatar_url: typeof profileData.avatar_url === 'string' ? profileData.avatar_url : null,
                address: typeof profileData.address === 'string' ? profileData.address : null,
                gender: typeof profileData.gender === 'string' ? profileData.gender : null,
                tts_enabled: Boolean(profileData.tts_enabled),
                stt_enabled: Boolean(profileData.stt_enabled),
                created_at: typeof profileData.created_at === 'string' ? profileData.created_at : undefined,
              };

              setProfile(userProfile);
              setFirstName(userProfile.first_name);
              setLastName(userProfile.last_name);
              setAddress(userProfile.address || "");
              setGender(userProfile.gender || "");
              setAvatarUrl(
                userProfile.avatar_url !== undefined
                  ? userProfile.avatar_url
                  : null
              );
              setTtsEnabled(userProfile.tts_enabled || false);
              setSttEnabled(userProfile.stt_enabled || false);
            }

            if (user.metadata.creationTime) {
              const date = new Date(user.metadata.creationTime);
              setCreatedAt(
                date.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              );
            }
          } catch (error) {
            console.error("Error fetching profile:", error);
            setError("Failed to load profile");
          } finally {
            setLoading(false);
          }
        });

        return () => unsubscribe();
      } catch (error: unknown) {
        console.error("Error in auth state:", error);
        setError(
          error instanceof Error ? error.message : "Failed to load profile"
        );
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [router]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setAvatarFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleToggleTTS = async () => {
    if (!isEditing) return;
    setTtsEnabled(!ttsEnabled);
  };

  const handleToggleSTT = async () => {
    if (!isEditing) return;
    setSttEnabled(!sttEnabled);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    setError(null);
    setSuccess(null);

    try {
      let newAvatarUrl = profile?.avatar_url;

      if (avatarFile && auth.currentUser) {
        const storage = getStorage();
        const fileExt = avatarFile.name.split(".").pop();
        const fileName = `avatars/${auth.currentUser.uid}-${Math.random()
          .toString(36)
          .substring(2)}.${fileExt}`;

        const storageRef = ref(storage, fileName);

        await uploadBytes(storageRef, avatarFile);

        newAvatarUrl = await getDownloadURL(storageRef);
      }

      if (!auth.currentUser) {
        throw new Error("No authenticated user found");
      }

      await updateUserProfile(auth.currentUser.uid, {
        first_name: firstName,
        last_name: lastName,
        address,
        gender,
        avatar_url: newAvatarUrl || null,
        tts_enabled: ttsEnabled,
        stt_enabled: sttEnabled,
        updated_at: new Date().toISOString(),
      });

      setSuccess("Profile updated successfully");
      setIsEditing(false);

      setProfile((prev) => {
        if (prev) {
          return {
            ...prev,
            first_name: firstName,
            last_name: lastName,
            address,
            gender,
            avatar_url: newAvatarUrl || null,
            tts_enabled: ttsEnabled,
            stt_enabled: sttEnabled,
          };
        }
        return prev;
      });
    } catch (error: unknown) {
      console.error("Error updating profile:", error);
      setError(
        error instanceof Error ? error.message : "Failed to update profile"
      );
    } finally {
      setUpdating(false);
    }
  };

  const testTTS = async () => {
    try {
      await testTextToSpeech();
    } catch (error: unknown) {
      console.error("TTS test failed:", error);
      setError(
        error instanceof Error ? error.message : "Text to speech test failed"
      );
    }
  };

  const handleGoBack = () => {
    router.push("/chat");
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center bg-gradient-to-b from-primary via-primary to-accent/10 px-4 sm:px-6">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-gradient-to-b from-primary via-primary to-accent/10 px-4 py-8 sm:px-6">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header with back button */}
        <div className="bg-accent text-white p-4 flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="mr-2 text-white hover:text-white/80 hover:bg-accent-dark"
            onClick={handleGoBack}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-xl font-semibold">Your Profile</h1>
        </div>

        {/* Avatar and basic info */}
        <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar with edit option */}
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 border-2 border-accent">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt="Profile"
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-accent/20 flex items-center justify-center">
                  <User size={40} className="text-accent" />
                </div>
              )}
            </div>

            {isEditing && (
              <label
                htmlFor="avatar-upload"
                className="absolute bottom-0 right-0 bg-accent text-white p-1 rounded-full cursor-pointer">
                <Camera size={16} />
                <input
                  id="avatar-upload"
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleAvatarChange}
                />
              </label>
            )}
          </div>

          {/* Basic info */}
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-2xl font-bold text-gray-800">
              {profile?.first_name} {profile?.last_name}
            </h2>
            <div className="flex items-center justify-center sm:justify-start mt-2 text-gray-600">
              <Mail className="w-4 h-4 mr-2" />
              <span>{profile?.email}</span>
            </div>
            {createdAt && (
              <div className="flex items-center justify-center sm:justify-start mt-2 text-gray-600">
                <Calendar className="w-4 h-4 mr-2" />
                <span>Member since {createdAt}</span>
              </div>
            )}

            {/* Edit/Save buttons */}
            <div className="mt-4 flex justify-center sm:justify-start gap-3">
              {!isEditing ? (
                <Button
                  onClick={() => setIsEditing(true)}
                  className="bg-accent hover:bg-accent-dark text-white">
                  Edit Profile
                </Button>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setIsEditing(false);

                      setFirstName(profile?.first_name || "");
                      setLastName(profile?.last_name || "");
                      setAddress(profile?.address || "");
                      setGender(profile?.gender || "");
                      setAvatarUrl(profile?.avatar_url || null);
                      setTtsEnabled(profile?.tts_enabled || false);
                      setSttEnabled(profile?.stt_enabled || false);
                      setAvatarFile(null);
                    }}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveProfile}
                    className="bg-accent hover:bg-accent-dark text-white"
                    disabled={updating}>
                    {updating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Save
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Status messages */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 text-red-700 rounded-md flex items-start">
            <X className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="mx-6 mt-4 p-3 bg-green-50 text-green-700 rounded-md flex items-start">
            <Check className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <p>{success}</p>
          </div>
        )}

        {/* Profile Form */}
        <form className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={!isEditing}
                className={cn(
                  "w-full p-2 border rounded-md",
                  isEditing
                    ? "border-gray-300 focus:ring-2 focus:ring-accent focus:border-transparent"
                    : "bg-gray-50 border-gray-200"
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={!isEditing}
                className={cn(
                  "w-full p-2 border rounded-md",
                  isEditing
                    ? "border-gray-300 focus:ring-2 focus:ring-accent focus:border-transparent"
                    : "bg-gray-50 border-gray-200"
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={!isEditing}
                className={cn(
                  "w-full p-2 border rounded-md",
                  isEditing
                    ? "border-gray-300 focus:ring-2 focus:ring-accent focus:border-transparent"
                    : "bg-gray-50 border-gray-200"
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                disabled={!isEditing}
                className={cn(
                  "w-full p-2 border rounded-md",
                  isEditing
                    ? "border-gray-300 focus:ring-2 focus:ring-accent focus:border-transparent"
                    : "bg-gray-50 border-gray-200"
                )}>
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Accessibility settings */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Accessibility Settings
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  {ttsEnabled ? (
                    <Volume2 className="h-5 w-5 text-accent mr-3" />
                  ) : (
                    <VolumeX className="h-5 w-5 text-gray-400 mr-3" />
                  )}
                  <div>
                    <div className="font-medium">Text to Speech</div>
                    <p className="text-sm text-gray-500">
                      Enable voice responses from the assistant
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="mr-2"
                    onClick={testTTS}
                    disabled={!ttsEnabled}>
                    Test
                  </Button>
                  <button
                    type="button"
                    onClick={handleToggleTTS}
                    disabled={!isEditing}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
                      ttsEnabled ? "bg-accent" : "bg-gray-200",
                      !isEditing && "opacity-60 cursor-not-allowed"
                    )}>
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        ttsEnabled ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  {sttEnabled ? (
                    <Mic className="h-5 w-5 text-accent mr-3" />
                  ) : (
                    <MicOff className="h-5 w-5 text-gray-400 mr-3" />
                  )}
                  <div>
                    <div className="font-medium">Speech to Text</div>
                    <p className="text-sm text-gray-500">
                      Speak to the assistant instead of typing
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleSTT}
                  disabled={!isEditing}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
                    sttEnabled ? "bg-accent" : "bg-gray-200",
                    !isEditing && "opacity-60 cursor-not-allowed"
                  )}>
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      sttEnabled ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Sign Out Section */}
        <div className="p-6 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Shield className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <div className="font-medium">Account Security</div>
                <p className="text-sm text-gray-500">
                  Sign out from your account
                </p>
              </div>
            </div>
            <SignOutButton />
          </div>
        </div>
      </div>
    </div>
  );
}
