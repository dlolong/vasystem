"use client";

import { AppProvider as Provider } from "@/context/AppContext";
import Toast from "@/components/ui/Toast";

export default function AppProvider({ children }) {
    return (
        <Provider>
            {children}
            <Toast />
        </Provider>
    );
}