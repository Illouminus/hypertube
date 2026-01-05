import styles from './Spinner.module.css';

interface SpinnerProps {
  size?: 'small' | 'medium' | 'large';
}

export function Spinner({ size = 'medium' }: SpinnerProps) {
  const sizeClass = {
    small: styles.spinnerSmall,
    medium: styles.spinnerMedium,
    large: styles.spinnerLarge,
  }[size];

  return <div className={`${styles.spinner} ${sizeClass}`} />;
}
