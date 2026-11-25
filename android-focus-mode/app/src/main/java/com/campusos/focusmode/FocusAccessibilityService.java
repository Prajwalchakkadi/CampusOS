package com.campusos.focusmode;

import android.accessibilityservice.AccessibilityService;
import android.view.accessibility.AccessibilityEvent;

import java.util.Set;

public class FocusAccessibilityService extends AccessibilityService {

    private static final String PREFS = "focus_mode";
    private static final String WHATSAPP = "com.whatsapp";
    private static final String YOUTUBE = "com.google.android.youtube";
    private static final String ANDROID_SETTINGS = "com.android.settings";

    private String lastBlockedPackage = "";
    private long lastActionTime = 0;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null
                || event.getEventType()
                != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            return;
        }

        String packageName = event.getPackageName() == null
                ? ""
                : event.getPackageName().toString();

        if (packageName.isEmpty()
                || packageName.equals(getPackageName())
                || packageName.equals(WHATSAPP)
                || packageName.equals(YOUTUBE)
                || packageName.equals(ANDROID_SETTINGS)) {
            return;
        }

        android.content.SharedPreferences prefs =
                getSharedPreferences(PREFS, MODE_PRIVATE);

        if (!prefs.getBoolean("focus_active", false)) {
            return;
        }

        long endTime = prefs.getLong("focus_end_time", 0);

        if (System.currentTimeMillis() >= endTime) {
            prefs.edit().putBoolean("focus_active", false).apply();
            return;
        }

        Set<String> blockedApps =
                prefs.getStringSet("blocked_packages", null);

        if (blockedApps == null || !blockedApps.contains(packageName)) {
            return;
        }

        long now = System.currentTimeMillis();

        if (packageName.equals(lastBlockedPackage)
                && now - lastActionTime < 1000) {
            return;
        }

        lastBlockedPackage = packageName;
        lastActionTime = now;

        performGlobalAction(GLOBAL_ACTION_HOME);
    }

    @Override
    public void onInterrupt() {
        // No continuous screen reading or recording is performed.
    }
}
