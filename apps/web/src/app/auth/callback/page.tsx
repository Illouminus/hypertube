'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { exchangeOAuthCode } from '@/lib/auth';
import { ApiRequestError } from '@/lib/api';
import { Spinner } from '@/components/ui';
import styles from './page.module.css';

function AuthCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const code = searchParams.get('code');
        const errorParam = searchParams.get('error');

        if (errorParam) {
            setError(decodeURIComponent(errorParam));
            return;
        }

        if (!code) {
            setError('No authorization code provided');
            return;
        }

        // Exchange code for tokens
        const exchangeCode = async () => {
            try {
                await exchangeOAuthCode(code);
                // Success - redirect to library
                router.replace('/library');
            } catch (err) {
                if (err instanceof ApiRequestError) {
                    setError(err.messages.join(', '));
                } else {
                    setError('Failed to complete authentication');
                }
            }
        };

        exchangeCode();
    }, [searchParams, router]);

    if (error) {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <div className={styles.errorIcon}>✕</div>
                    <h1 className={styles.title}>Authentication Failed</h1>
                    <p className={styles.message}>{error}</p>
                    <a href="/login" className={styles.button}>
                        Back to Login
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <Spinner />
                <p className={styles.message}>Completing sign in...</p>
            </div>
        </div>
    );
}

export default function AuthCallbackPage() {
    return (
        <Suspense
            fallback={
                <div className={styles.container}>
                    <div className={styles.card}>
                        <Spinner />
                        <p className={styles.message}>Loading...</p>
                    </div>
                </div>
            }
        >
            <AuthCallbackContent />
        </Suspense>
    );
}
