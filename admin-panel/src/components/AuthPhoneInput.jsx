import { useEffect, useMemo } from 'react';
import PhoneInput from 'react-phone-number-input';
import { getCountries } from 'react-phone-number-input';
import { detectBrowserPhoneCountry } from '../utils/phoneCountry';
import 'react-phone-number-input/style.css';

export default function AuthPhoneInput({
  value,
  onChange,
  onCountryChange,
  disabled = false,
  accentColor = '#22c55e',
}) {
  const defaultCountry = useMemo(() => detectBrowserPhoneCountry(getCountries()), []);

  useEffect(() => {
    onCountryChange?.(defaultCountry);
  }, [defaultCountry, onCountryChange]);

  return (
    <div
      className="auth-phone-input"
      style={{ '--auth-phone-accent': accentColor }}
    >
      <PhoneInput
        international={false}
        defaultCountry={defaultCountry}
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
