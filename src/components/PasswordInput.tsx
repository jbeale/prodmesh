import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/** A password field that stays masked by default, but lets its owner verify a
 * value before submitting it. This deliberately has no persistence of its
 * visibility state, so sensitive values are hidden again on a fresh screen. */
export function PasswordInput({ className = 'field', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="password-input">
      <input {...props} className={className} type={visible ? 'text' : 'password'} />
      <button
        className="password-input__toggle"
        type="button"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
      </button>
    </span>
  );
}
