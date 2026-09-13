import { useEffect, useState } from "react";
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

  // Local "draft" selection for immediate checkbox feedback while the
  // dropdown is open. Only committed to Redux (which triggers the
  // /api/records refetch) when the dropdown closes — otherwise every
  // single checkbox click would fire its own request while the user is
  // still picking.
  const [draft, setDraft] = useState<string[]>(selected);

  // Keep draft in sync if the global selection changes elsewhere
  // (e.g. the "Clear filters" button).
  useEffect(() => {
    setDraft(selected);
  }, [selected]);

  const handleChange = (event: SelectChangeEvent<string[]>) => {
    const { value } = event.target;
    const values = typeof value === "string" ? value.split(",") : value;
    setDraft(values);
  };

  const handleClose = () => {
    dispatch(setField({ field, values: draft }));
  };

  return (
    <FormControl sx={{ minWidth: 220 }} size="small">
      <InputLabel id={`${field}-label`}>{label}</InputLabel>
      <Select
        labelId={`${field}-label`}
        multiple
        value={draft}
        onChange={handleChange}
        onClose={handleClose}
        input={<OutlinedInput label={label} />}
        renderValue={(values) => (values.length === 0 ? "All" : values.join(", "))}
      >
        {options.map((option) => (
          <MenuItem key={option} value={option}>
            <Checkbox checked={draft.includes(option)} />
            <ListItemText primary={option} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
