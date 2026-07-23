import { useId, type InputHTMLAttributes } from 'react';
import { INDIAN_CITIES } from '../../data/indianCities';

type CityInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'list'
>;

export function CityInput({
  name = 'city',
  autoComplete = 'address-level2',
  placeholder = 'City',
  ...props
}: CityInputProps) {
  const listId = useId();

  return (
    <>
      <input
        type="text"
        name={name}
        list={listId}
        autoComplete={autoComplete}
        placeholder={placeholder}
        {...props}
      />
      <datalist id={listId}>
        {INDIAN_CITIES.map((city) => (
          <option key={city} value={city} />
        ))}
      </datalist>
    </>
  );
}
