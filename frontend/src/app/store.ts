import { configureStore } from "@reduxjs/toolkit";
import { api } from "./api.js";
import filtersReducer from "../features/filters/filtersSlice.js";

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    filters: filtersReducer,
  },
  // RTK Query's middleware enables caching, invalidation, polling, etc.
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
