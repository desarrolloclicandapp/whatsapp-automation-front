import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

export default function AuthPhoneInput({
  value,
  onChange,
  onCountryChange,
  disabled = false,
  accentColor = '#22c55e',
}) {
  return (
    <div
      className="auth-phone-input"
      style={{ '--auth-phone-accent': accentColor }}
    >
      <PhoneInput
        international={false}
        defaultCountry="PY"
        value={value}
        onChange={(nextValue) => onChange(nextValue || '')}
        onCountryChange={(nextCountry) => onCountryChange?.(nextCountry || '')}
        disabled={disabled}
        countryCallingCodeEditable={false}
        smartCaret
      />
    </div>
  );
}
