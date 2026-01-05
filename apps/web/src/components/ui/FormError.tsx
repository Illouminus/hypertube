import styles from './FormError.module.css';

interface FormErrorProps {
  errors: string | string[];
}

export function FormError({ errors }: FormErrorProps) {
  const errorList = Array.isArray(errors) ? errors : [errors];
  
  if (errorList.length === 0) return null;

  return (
    <div className={styles.error}>
      {errorList.map((err, i) => (
        <p key={i} className={styles.errorItem}>
          {err}
        </p>
      ))}
    </div>
  );
}
