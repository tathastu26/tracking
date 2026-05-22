'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/main-layout'
import { ProfileSection } from '@/components/profile-section'
import { AlertStrip } from '@/components/alert-strip'
import { Mail, Phone, MapPin, Lock, LogOut, Upload } from 'lucide-react'
import { buildIntegrityRecord, verifyIntegrityChain } from '@/lib/integrity'

interface UserProfile {
  id: string
  full_name: string
  email: string
  phone: string
  location: string
  passport_document?: string
  other_documents?: string[]
  created_at: string
  updated_at: string
}

interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
  read: boolean
  created_at: string
}

interface IntegrityLogRow {
  id: string
  hash: string
  prev_hash: string | null
  payload_snapshot: Record<string, unknown>
  version: number
  created_at: string
}

export default function ProfilePage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [integrityFingerprint, setIntegrityFingerprint] = useState<string | null>(null)
  const [integrityLogs, setIntegrityLogs] = useState<IntegrityLogRow[]>([])
  const [integrityVerification, setIntegrityVerification] = useState<{
    valid: boolean
    brokenAt?: number
  } | null>(null)

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    location: '',
  })

  const [passportFile, setPassportFile] = useState<File | null>(null)
  const [passportPreview, setPassportPreview] = useState<string | null>(null)

  // Load user and profile data
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          router.push('/login')
          return
        }

        setUser(user)

        // Load profile data
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Error loading profile:', profileError)
        }

        if (profileData) {
          setProfile(profileData)
          setFormData({
            full_name: profileData.full_name || '',
            phone: profileData.phone || '',
            location: profileData.location || '',
          })
          if (profileData.passport_document) {
            setPassportPreview(profileData.passport_document)
          }
        } else {
          // Create new profile record
          const { error: insertError } = await supabase
            .from('profiles')
            .insert([
              {
                id: user.id,
                full_name: '',
                email: user.email,
                phone: '',
                location: '',
              },
            ])
          if (insertError) console.error('Error creating profile:', insertError)
        }

        // Load notifications
        const { data: notifData, error: notifError } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10)

        if (notifError) {
          console.error('Error loading notifications:', notifError)
        } else {
          setNotifications(notifData || [])
        }

        const { data: latestIntegrity } = await supabase
          .from('profile_integrity_log')
          .select('hash')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (latestIntegrity?.hash) {
          setIntegrityFingerprint(latestIntegrity.hash)
        }
      } catch (err: any) {
        setError('Failed to load user data')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadUserData()
  }, [supabase, router])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPassportFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPassportPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      let passportUrl = profile?.passport_document || null

      // Upload passport file if provided
      if (passportFile && user) {
        const fileName = `${user.id}/passport_${Date.now()}`
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, passportFile, { upsert: true })

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(fileName)
        passportUrl = urlData?.publicUrl || null
      }

      const timestamp = new Date().toISOString()
      const payload = {
        full_name: formData.full_name,
        phone: formData.phone,
        location: formData.location,
        passport_document: passportUrl,
        updated_at: timestamp,
      }

      const { data: latestLog, error: latestLogError } = await supabase
        .from('profile_integrity_log')
        .select('hash')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestLogError) throw latestLogError

      const prevHash = latestLog?.hash ?? null
      const integrityRecord = await buildIntegrityRecord(payload, prevHash)

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id)

      if (updateError) throw updateError

      const { error: integrityInsertError } = await supabase
        .from('profile_integrity_log')
        .insert({
          user_id: user.id,
          hash: integrityRecord.hash,
          prev_hash: prevHash,
          payload_snapshot: payload,
          version: integrityRecord.version,
          created_at: integrityRecord.timestamp,
        })

      if (integrityInsertError) throw integrityInsertError

      setSuccess('Profile updated successfully')
      setPassportFile(null)
      setIntegrityFingerprint(integrityRecord.hash)
      setIntegrityVerification(null)

      // Reload profile
      const { data: updatedProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (updatedProfile) {
        setProfile(updatedProfile)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const handleVerifyIntegrity = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('profile_integrity_log')
        .select('id, hash, prev_hash, payload_snapshot, version, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      if (error) throw error

      const rows = (data || []) as IntegrityLogRow[]
      setIntegrityLogs(rows)

      const verification = await verifyIntegrityChain(
        rows.map((row) => ({
          hash: row.hash,
          prevHash: row.prev_hash,
          data: row.payload_snapshot,
          timestamp: row.created_at,
          version: row.version,
        }))
      )

      setIntegrityVerification(verification)
    } catch (err: any) {
      setError(err.message || 'Failed to verify data integrity')
    }
  }

  const handleDeletePassword = async () => {
    if (
      !window.confirm(
        'Are you sure you want to delete your password? This will log you out.'
      )
    ) {
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: '',
      })
      if (error) throw error
      setSuccess('Password deleted. Redirecting to login...')
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to delete password')
    }
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/login')
    } catch (err: any) {
      setError('Failed to logout')
    }
  }

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)

      if (error) throw error

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      )
    } catch (err) {
      console.error('Failed to mark notification as read:', err)
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="p-8 flex items-center justify-center min-h-screen">
          <p className="text-foreground">Loading profile...</p>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Profile</h1>
            <p className="text-muted-foreground mt-1">
              Manage your account settings and details
            </p>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <AlertStrip
            type="error"
            title="Error"
            message={error}
            action={{
              label: 'Dismiss',
              onClick: () => setError(null),
            }}
          />
        )}

        {success && (
          <AlertStrip
            type="success"
            title="Success"
            message={success}
            action={{
              label: 'Dismiss',
              onClick: () => setSuccess(null),
            }}
          />
        )}

        {/* Personal Information Section */}
        <ProfileSection
          title="Personal Information"
          subtitle="Update your account details"
          action={{
            label: saving ? 'Saving...' : 'Save',
            onClick: handleSaveProfile,
          }}
        >
          <div className="space-y-4">
            {integrityFingerprint && (
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                  Data fingerprint: {integrityFingerprint.slice(0, 12)}
                </span>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Email Address
              </label>
              <div className="p-3 bg-muted/50 rounded border border-border/50 flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm text-foreground">{user?.email}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {user?.email_confirmed_at
                  ? '✓ Email verified'
                  : 'Awaiting email verification'}
              </p>
            </div>

            <div>
              <label htmlFor="full_name" className="block text-sm font-semibold text-foreground mb-2">
                Full Name
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                value={formData.full_name}
                onChange={handleInputChange}
                placeholder="Enter your full name"
                className="w-full px-4 py-2 bg-muted border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-semibold text-foreground mb-2">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="+1 (555) 123-4567"
                  className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-semibold text-foreground mb-2">
                Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="location"
                  name="location"
                  type="text"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="City, State"
                  className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>
        </ProfileSection>

        {/* Documents Section */}
        <ProfileSection
          title="Documents"
          subtitle="Upload your passport and other identification documents (optional)"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-3">
                Passport Document
              </label>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  id="passport-upload"
                />
                <label htmlFor="passport-upload" className="cursor-pointer">
                  {passportPreview ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        Document selected
                      </p>
                      {passportFile?.name && (
                        <p className="text-xs text-muted-foreground">
                          {passportFile.name}
                        </p>
                      )}
                      <img
                        src={passportPreview}
                        alt="Preview"
                        className="max-h-32 mx-auto rounded"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-8 h-8 text-muted-foreground mx-auto" />
                      <p className="text-sm font-medium text-foreground">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground">
                        PNG, JPG, PDF up to 10MB
                      </p>
                    </div>
                  )}
                </label>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                This field is optional. Upload clear photos of your passport.
              </p>
            </div>
          </div>
        </ProfileSection>

        {/* Notifications Section */}
        <ProfileSection
          title="Notifications"
          subtitle="Your recent notifications and alerts"
        >
          <div className="space-y-3">
            {notifications.length === 0 ? (
              <div className="p-4 bg-muted/50 rounded border border-border/50 text-center">
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 rounded border transition-colors cursor-pointer ${
                    notif.read
                      ? 'bg-muted/30 border-border/50'
                      : 'bg-primary/5 border-primary/30'
                  }`}
                  onClick={() => markNotificationAsRead(notif.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground text-sm">
                        {notif.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {notif.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(notif.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {!notif.read && (
                      <div className="w-2 h-2 bg-primary rounded-full ml-2 mt-1.5" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ProfileSection>

        {/* Security Section */}
        <ProfileSection
          title="Security & Account"
          subtitle="Manage your account security"
        >
          <div className="space-y-3">
            <button
              onClick={handleDeletePassword}
              className="w-full text-left p-4 bg-destructive/5 border border-destructive/30 rounded hover:bg-destructive/10 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-destructive" />
                <div>
                  <h4 className="text-sm font-semibold text-destructive">
                    Delete Password
                  </h4>
                  <p className="text-xs text-destructive/80 mt-1">
                    Remove password from your account. This action cannot be undone.
                  </p>
                </div>
              </div>
            </button>
          </div>
        </ProfileSection>

        {/* Data Integrity Section */}
        <ProfileSection
          title="Data Integrity"
          subtitle="Verify the cryptographic chain for profile saves"
        >
          <div className="space-y-4">
            <button
              onClick={handleVerifyIntegrity}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors text-sm"
              title="Each save creates a cryptographic fingerprint linked to the previous one. If any record is altered server-side, verification will fail."
            >
              Verify Integrity
            </button>

            {integrityVerification && (
              <div
                className={`rounded border px-4 py-3 text-sm ${
                  integrityVerification.valid
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                    : 'border-red-500/30 bg-red-500/10 text-red-200'
                }`}
              >
                {integrityVerification.valid ? (
                  <span>Chain intact — all {integrityLogs.length} saves verified</span>
                ) : (
                  <span>
                    Integrity broken at save #{integrityVerification.brokenAt} — possible tampering detected
                    {(() => {
                      const brokenRow = integrityLogs[(integrityVerification.brokenAt || 1) - 1]
                      return brokenRow ? ` (${new Date(brokenRow.created_at).toLocaleString()})` : ''
                    })()}
                  </span>
                )}
              </div>
            )}

            {integrityLogs.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Last 5 saves</div>
                {integrityLogs.slice(-5).map((log, index) => {
                  const startIndex = Math.max(0, integrityLogs.length - 5)
                  const globalIndex = startIndex + index
                  const isVerified = !integrityVerification || integrityVerification.valid || (integrityVerification.brokenAt ? globalIndex + 1 < integrityVerification.brokenAt : false)

                  return (
                    <div key={log.id} className="flex flex-col gap-2 rounded border border-border/50 bg-muted/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm text-foreground">{new Date(log.created_at).toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">{log.hash.slice(0, 12)}...</div>
                      </div>
                      <span className={`self-start rounded-full border px-2 py-1 text-xs font-semibold ${isVerified ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-red-500/30 bg-red-500/10 text-red-200'}`}>
                        {isVerified ? '✓ Verified' : '✗ Failed'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </ProfileSection>

        {/* Footer */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 bg-muted/50 border border-border rounded text-xs text-muted-foreground">
          <span>Last updated: {profile?.updated_at ? new Date(profile.updated_at).toLocaleDateString() : 'Never'}</span>
          <span>Account status: Active</span>
        </div>
      </div>
    </MainLayout>
  )
}
