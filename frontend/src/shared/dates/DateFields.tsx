import { DatePicker, DateTimePicker } from '@mui/x-date-pickers';
import dayjs, { type Dayjs } from 'dayjs';
import type { DatePickerProps, DateTimePickerProps } from '@mui/x-date-pickers';
import type { ReactNode } from 'react';
import { dayjsFromIsoDate, DATE_DISPLAY_FORMAT, DATE_TIME_DISPLAY_FORMAT, toApiDate, toApiDateTime } from './dateUtils';

type SharedFieldProps = { label?: string; disabled?: boolean; error?: boolean; helperText?: ReactNode };
type FechaPickerProps = SharedFieldProps & Omit<DatePickerProps<Dayjs>, 'value' | 'onChange' | 'format'>;
type FechaDateTimePickerProps = SharedFieldProps & Omit<DateTimePickerProps<Dayjs>, 'value' | 'onChange' | 'format'>;

export function FechaInput({ value, onChange, slotProps, ...props }: FechaPickerProps & { value: string | null; onChange: (value: string | null) => void }) {
  const textField = { ...(slotProps?.textField as object | undefined), ...(props.error === undefined ? {} : { error: props.error }), ...(props.helperText === undefined ? {} : { helperText: props.helperText }) };
  return <DatePicker<Dayjs> {...props} value={dayjsFromIsoDate(value)} format={DATE_DISPLAY_FORMAT} onChange={(next) => onChange(next?.isValid() ? toApiDate(next) : null)} slotProps={{ ...slotProps, textField }} />;
}

export function FechaHoraInput({ value, onChange, slotProps, ...props }: FechaDateTimePickerProps & { value: string | null; onChange: (value: string | null) => void }) {
  const textField = { ...(slotProps?.textField as object | undefined), ...(props.error === undefined ? {} : { error: props.error }), ...(props.helperText === undefined ? {} : { helperText: props.helperText }) };
  return <DateTimePicker<Dayjs> {...props} value={value ? dayjs(value) : null} format={DATE_TIME_DISPLAY_FORMAT} onChange={(next) => onChange(next?.isValid() ? toApiDateTime(next) : null)} slotProps={{ ...slotProps, textField }} />;
}

export function FechaRangoInput({ from, to, onChange, ...props }: SharedFieldProps & { from: string | null; to: string | null; onChange: (from: string | null, to: string | null) => void }) {
  return <><FechaInput {...props} label={props.label ?? 'Desde'} value={from} onChange={(next) => onChange(next, to)} /><FechaInput {...props} label="Hasta" value={to} onChange={(next) => onChange(from, next)} /></>;
}

export type FechaInputProps = DatePickerProps<Dayjs>;
export type FechaHoraInputProps = DateTimePickerProps<Dayjs>;
