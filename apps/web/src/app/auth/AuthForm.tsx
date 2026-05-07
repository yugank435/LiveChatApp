'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { api, storeSession } from '../../lib/api';
import styles from './auth.module.css';

type AuthFormProps = {
  mode: 'login' | 'signup';
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isSignup = mode === 'signup';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const auth = isSignup
        ? await api.signup(name, email, password)
        : await api.login(email, password);
      storeSession(auth);
      router.push('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.brand}>
        <h1>Live conversations, delivered instantly.</h1>
      </section>
      <section className={styles.panel}>
        <form className={styles.form} onSubmit={submit}>
          <h2>{isSignup ? 'Create account' : 'Welcome back'}</h2>
          <p>{isSignup ? 'Start messaging with your team.' : 'Sign in to continue chatting.'}</p>
          {error ? <div className={styles.error}>{error}</div> : null}
          {isSignup ? (
            <label className={styles.field}>
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
          ) : null}
          <label className={styles.field}>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className={styles.field}>
            Password
            <input
              type="password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button className={styles.button} disabled={loading}>
            {loading ? 'Please wait...' : isSignup ? 'Sign up' : 'Log in'}
          </button>
          <div className={styles.switch}>
            {isSignup ? (
              <>
                Already have an account? <Link href="/login">Log in</Link>
              </>
            ) : (
              <>
                New here? <Link href="/signup">Create an account</Link>
              </>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
