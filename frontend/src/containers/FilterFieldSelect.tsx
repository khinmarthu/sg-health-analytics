import {
  Checkbox,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  type SelectChangeEvent,
} from "@mui/material";
import { useAppDispatch, useAppSelector } from "../redux/hooks.js";
import { setField, type FiltersState } from "../redux/filtersSlice.js";

interface FilterFieldSelectProps {
  field: keyof FiltersState;
  label: string;
  options: string[];
}

/** One dropdown: closed, shows a checkbox list of `options` when opened.
 * Standard MUI "Select with checkmarks" pattern for multi-select. */
export function FilterFieldSelect({ field, label, options }: FilterFieldSelectProps) {
  const dispatch = useAppDispatch();
  const selected = useAppSelector((state) => state.filters[field]);

  const handleChange = (event: SelectChangeEvent<string[]>) => {
    const { value } = event.target;
    const values = typeof value === "string" ? value.split(",") : value;
    dispatch(setField({ field, values }));
  };

  return (
    <FormControl sx={{ minWidth: 220 }} size="small">
      <InputLabel id={`${field}-label`}>{label}</InputLabel>
      <Select
        labelId={`${field}-label`}
        multiple
        value={selected}
        onChange={handleChange}
        input={<OutlinedInput label={label} />}
        renderValue={(values) => (values.length === 0 ? "All" : values.join(", "))}
      >
        {options.map((option) => (
          <MenuItem key={option} value={option}>
            <Checkbox checked={selected.includes(option)} />
            <ListItemText primary={option} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
