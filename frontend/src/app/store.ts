import { configureStore } from "@reduxjs/toolkit";
import { api } from "./api.js";

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
  },
  // RTK Query's middleware enables caching, invalidation, polling, etc.
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
