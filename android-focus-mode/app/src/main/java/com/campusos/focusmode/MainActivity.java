package com.campusos.focusmode;

import android.app.Activity;
import android.os.Bundle;
import android.os.CountDownTimer;
import android.os.Handler;
import android.os.Looper;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.View;
import android.content.Intent;
import android.content.ComponentName;
import android.provider.Settings;
import android.text.TextUtils;
import android.app.AlertDialog;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.ArrayAdapter;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.EditText;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

public class MainActivity extends Activity {

    private final int green = Color.rgb(5, 150, 105);
    private final int darkGreen = Color.rgb(167, 243, 208);
    private final int textColor = Color.rgb(236, 253, 245);

    private static final String WHATSAPP = "com.whatsapp";
    private static final String YOUTUBE = "com.google.android.youtube";
    private static final String INSTAGRAM = "com.instagram.android";
    private static final String FACEBOOK = "com.facebook.katana";

    private TextView timerText;
    private TextView statusText;
    private Button startButton;
    private CountDownTimer countdown;
    private long remainingMillis = 25 * 60 * 1000L;
    private boolean running = false;
    private Spinner durationSpinner;
    private TextView accessibilityStatus;
    private EditText pairingCodeInput;
    private TextView pairingStatus;
    private Button pairButton;
    private String deviceToken = null;
    private String currentSessionId = null;
    private long currentSessionDurationMillis = 0;
    private boolean networkBusy = false;


    private final ExecutorService networkExecutor =
            Executors.newSingleThreadExecutor();

    private final Handler mainHandler =
            new Handler(Looper.getMainLooper());

    private final ArrayList<CheckBox> selectableApps = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundResource(R.drawable.bg_emerald_3d);

        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(24, 30, 24, 30);

        scroll.addView(page);
        setContentView(scroll);

        TextView title = new TextView(this);
        title.setText("CampusOS Focus Mode");
        title.setTextSize(27);
        title.setTypeface(null, Typeface.BOLD);
        title.setTextColor(darkGreen);
        page.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText("Take control of your study time.");
        subtitle.setTextSize(15);
        subtitle.setTextColor(textColor);
        subtitle.setPadding(0, 8, 0, 24);
        page.addView(subtitle);

        addHeading(page, "Choose your focus duration");

        durationSpinner = new Spinner(this);

        String[] durations = {
                "25 minutes", "45 minutes",
                "50 minutes", "60 minutes",
                "90 minutes", "120 minutes"
        };

        ArrayAdapter<String> adapter = new ArrayAdapter<>(
                this,
                android.R.layout.simple_spinner_item,
                durations
        );

        adapter.setDropDownViewResource(
                android.R.layout.simple_spinner_dropdown_item
        );

        durationSpinner.setAdapter(adapter);
        page.addView(durationSpinner);

        addHeading(page, "Apps that stay allowed");
        addInfo(page, "WhatsApp  ✓  Always allowed");
        addInfo(page, "YouTube  ✓  Always allowed");
        addInfo(page, "These apps cannot be selected for blocking.");

        addHeading(page, "Choose installed apps to block");

        TextView explanation = new TextView(this);
        explanation.setText(
                "Select the apps you want to keep away during your study session."
        );
        explanation.setTextSize(14);
        explanation.setTextColor(textColor);
        explanation.setPadding(0, 0, 0, 10);
        page.addView(explanation);

        loadInstalledApps(page);

        addHeading(page, "Enable app blocking");

        addInfo(page,
                "Accessibility permission is required to restrict selected apps. "
                + "CampusOS checks foreground app changes only.");

        accessibilityStatus = new TextView(this);
        accessibilityStatus.setTextSize(14);
        accessibilityStatus.setTextColor(textColor);
        accessibilityStatus.setPadding(12, 8, 12, 8);
        page.addView(accessibilityStatus);

        Button accessibilityButton = new Button(this);
        accessibilityButton.setText("Open Accessibility Settings");
        accessibilityButton.setTextColor(Color.rgb(167, 243, 208));
        accessibilityButton.setBackgroundResource(R.drawable.bg_emerald_card);
        accessibilityButton.setElevation(4);
        page.addView(accessibilityButton);
        accessibilityButton.setOnClickListener(v -> showAccessibilityConsent());

        addHeading(page, "Connect to CampusOS");

        addInfo(page, "Generate a one-time pairing code from your CampusOS Student Dashboard and enter it here.");

        pairingCodeInput = new EditText(this);
        pairingCodeInput.setSingleLine(true);
        pairingCodeInput.setHint("Enter 16-character pairing code");
        pairingCodeInput.setTextColor(textColor);
        pairingCodeInput.setHintTextColor(Color.LTGRAY);
        pairingCodeInput.setFilters(
                new android.text.InputFilter[]{
                    new android.text.InputFilter.LengthFilter(16)
                }
        );
        pairingCodeInput.setInputType(
                android.text.InputType.TYPE_CLASS_TEXT
                | android.text.InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS
                | android.text.InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
        );
        pairingCodeInput.setPadding(16, 14, 16, 14);
        pairingCodeInput.setBackgroundResource(R.drawable.bg_emerald_card);
        page.addView(pairingCodeInput);

        pairButton = new Button(this);
        pairButton.setText("Pair This Android Device");
        pairButton.setTextColor(Color.WHITE);
        pairButton.setBackgroundResource(R.drawable.bg_emerald_button);
        page.addView(pairButton);

        pairingStatus = new TextView(this);
        pairingStatus.setTextColor(textColor);
        pairingStatus.setTextSize(14);
        pairingStatus.setPadding(8, 10, 8, 10);
        pairingStatus.setText("Checking device connection...");
        page.addView(pairingStatus);

        pairButton.setOnClickListener(v -> pairDevice());
        loadPairingStatus();

        addHeading(page, "Your focus session");

        timerText = new TextView(this);
        timerText.setText("25:00");
        timerText.setTextSize(48);
        timerText.setTypeface(null, Typeface.BOLD);
        timerText.setTextColor(darkGreen);
        timerText.setGravity(Gravity.CENTER);
        timerText.setBackgroundResource(R.drawable.bg_emerald_card);
        timerText.setMinHeight(150);
        timerText.setPadding(0, 18, 0, 10);
        page.addView(timerText);

        statusText = new TextView(this);
        statusText.setText("Ready when you are.");
        statusText.setTextSize(14);
        statusText.setTextColor(textColor);
        statusText.setGravity(Gravity.CENTER);
        page.addView(statusText);

        startButton = new Button(this);
        startButton.setText("Start Focus Session");
        startButton.setTextColor(Color.WHITE);
        startButton.setBackgroundResource(R.drawable.bg_emerald_button);
        startButton.setPadding(20, 14, 20, 14);
        startButton.setElevation(8);

        LinearLayout.LayoutParams buttonParams =
                new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                );

        buttonParams.setMargins(0, 24, 0, 10);
        page.addView(startButton, buttonParams);

        Button resetButton = new Button(this);
        resetButton.setText("Reset Session");
        resetButton.setTextColor(Color.rgb(167, 243, 208));
        resetButton.setBackgroundResource(R.drawable.bg_emerald_card);
        resetButton.setElevation(4);
        page.addView(resetButton);

        startButton.setOnClickListener(v -> toggleTimer());
        resetButton.setOnClickListener(v -> resetTimer());

        durationSpinner.setOnItemSelectedListener(
                new android.widget.AdapterView.OnItemSelectedListener() {
                    @Override
                    public void onItemSelected(
                            android.widget.AdapterView<?> parent,
                            View view,
                            int position,
                            long id
                    ) {
                        if (!running) {
                            String selected = durations[position];
                            int minutes = Integer.parseInt(
                                    selected.replace(" minutes", "")
                            );
                            remainingMillis = minutes * 60 * 1000L;
                            updateTimerText();
                        }
                    }

                    @Override
                    public void onNothingSelected(
                            android.widget.AdapterView<?> parent
                    ) {}
                }
        );
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateAccessibilityStatus();
    }

    private void loadPairingStatus() {
        networkExecutor.execute(() -> {
            try {
                String savedToken = SecureTokenStore.read(MainActivity.this);

                mainHandler.post(() -> {
                    deviceToken = savedToken;

                    if (savedToken != null) {
                        pairingStatus.setText("Device paired successfully with CampusOS.");
                        pairButton.setText("Device Paired");
                    } else {
                        pairingStatus.setText("This Android device is not paired yet.");
                    }
                });
            } catch (Exception error) {
                mainHandler.post(() ->
                    pairingStatus.setText("Unable to read saved pairing. Please pair again.")
                );
            }
        });
    }

    private void pairDevice() {
        String code = pairingCodeInput.getText()
                .toString().trim().toUpperCase(Locale.ROOT);

        if (!code.matches("[A-F0-9]{16}")) {
            pairingCodeInput.setError("Enter the valid 16-character pairing code.");
            return;
        }

        pairButton.setEnabled(false);
        pairButton.setText("Pairing...");
        pairingStatus.setText("Connecting to CampusOS...");

        networkExecutor.execute(() -> {
            try {
                JSONObject result = FocusApiClient.exchangePairingCode(code);
                String token = result.optString("deviceToken", "");

                if (!result.optBoolean("success")
                        || !token.matches("[a-fA-F0-9]{64}")) {
                    throw new Exception("Invalid device credential received.");
                }

                SecureTokenStore.save(MainActivity.this, token);

                mainHandler.post(() -> {
                    deviceToken = token;
                    pairingStatus.setText("Device paired successfully with CampusOS.");
                    pairingCodeInput.setText("");
                    pairButton.setText("Device Paired");
                    pairButton.setEnabled(true);

                    Toast.makeText(
                            MainActivity.this,
                            "CampusOS device pairing successful!",
                            Toast.LENGTH_LONG
                    ).show();
                });

            } catch (Exception error) {
                String message = error.getMessage();

                mainHandler.post(() -> {
                    pairingStatus.setText(
                            "Pairing failed: " +
                            (message == null ? "Please try again." : message)
                    );
                    pairButton.setText("Pair This Android Device");
                    pairButton.setEnabled(true);
                });
            }
        });
    }

    private boolean hasAccessibilityConsent() {
        return getSharedPreferences("focus_mode_privacy", MODE_PRIVATE)
                .getBoolean("accessibility_consent", false);
    }

    private void showAccessibilityConsent() {
        new AlertDialog.Builder(this)
                .setTitle("CampusOS Accessibility Disclosure")
                .setMessage(
                        "CampusOS Focus Mode uses Android Accessibility access "
                        + "to detect changes in the foreground app. It checks "
                        + "the app package name against the apps you selected "
                        + "for blocking. If a selected blocked app opens during "
                        + "an active session, CampusOS sends you to the Home screen.\n\n"
                        + "During cloud session creation, selected blocked-app "
                        + "package identifiers are also sent to the CampusOS backend "
                        + "for session synchronization.\n\n"
                        + "CampusOS does not use this service to read screen text, "
                        + "messages or passwords, or to record your screen.\n\n"
                        + "You can decline. App blocking will remain unavailable "
                        + "unless you give consent and enable the service in Android Settings."
                )
                .setPositiveButton("Agree and Continue", (dialog, which) -> {
                    getSharedPreferences("focus_mode_privacy", MODE_PRIVATE)
                            .edit()
                            .putBoolean("accessibility_consent", true)
                            .apply();

                    startActivity(
                            new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                    );
                })
                .setNegativeButton("Decline", (dialog, which) -> {
                    getSharedPreferences("focus_mode_privacy", MODE_PRIVATE)
                            .edit()
                            .putBoolean("accessibility_consent", false)
                            .apply();

                    stopForConsentWithdrawal();

                    Toast.makeText(
                            this,
                            "Accessibility consent declined. App blocking is unavailable.",
                            Toast.LENGTH_LONG
                    ).show();
                })
                .setCancelable(true)
                .show();
    }

    private void stopForConsentWithdrawal() {
        if (countdown != null) {
            countdown.cancel();
            countdown = null;
        }

        running = false;
        saveFocusSession(false);

        int elapsedSeconds = (int) Math.max(
                0,
                (currentSessionDurationMillis - remainingMillis) / 1000L
        );

        String stoppedSessionId = currentSessionId;
        currentSessionId = null;

        if (stoppedSessionId != null) {
            syncCloudSessionEnd(
                    stoppedSessionId,
                    "cancelled",
                    elapsedSeconds
            );
        }

        startButton.setText("Start Focus Session");
        statusText.setText("Session stopped. Accessibility consent withdrawn.");
        updateTimerText();
    }

    private boolean isAccessibilityServiceEnabled() {
        String enabledServices = Settings.Secure.getString(
                getContentResolver(),
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        );

        if (TextUtils.isEmpty(enabledServices)) {
            return false;
        }

        String expected = new ComponentName(
                this,
                FocusAccessibilityService.class
        ).flattenToString();

        TextUtils.SimpleStringSplitter splitter =
                new TextUtils.SimpleStringSplitter(':');
        splitter.setString(enabledServices);

        for (String service : splitter) {
            if (expected.equalsIgnoreCase(service)) {
                return true;
            }
        }

        return false;
    }

    private void updateAccessibilityStatus() {
        if (accessibilityStatus == null) {
            return;
        }

        if (isAccessibilityServiceEnabled()) {
            accessibilityStatus.setText("App blocking permission: ENABLED");
        } else {
            accessibilityStatus.setText("App blocking permission: NOT ENABLED");
        }
    }

    private void saveFocusSession(boolean active) {
        Set<String> blockedPackages = new HashSet<>();

        for (CheckBox checkBox : selectableApps) {
            if (checkBox.isChecked() && checkBox.getTag() instanceof String) {
                String packageName = (String) checkBox.getTag();

                if (!packageName.equals(WHATSAPP)
                        && !packageName.equals(YOUTUBE)) {
                    blockedPackages.add(packageName);
                }
            }
        }

        getSharedPreferences("focus_mode", MODE_PRIVATE)
                .edit()
                .putStringSet("blocked_packages", blockedPackages)
                .putLong(
                        "focus_end_time",
                        active ? System.currentTimeMillis() + remainingMillis : 0
                )
                .putBoolean("focus_active", active)
                .apply();
    }

    private void loadInstalledApps(LinearLayout page) {
        PackageManager packageManager = getPackageManager();

        Intent launcherIntent = new Intent(Intent.ACTION_MAIN);
        launcherIntent.addCategory(Intent.CATEGORY_LAUNCHER);

        ArrayList<ResolveInfo> installedApps =
                new ArrayList<>(
                        packageManager.queryIntentActivities(launcherIntent, 0)
                );

        Collections.sort(
                installedApps,
                new Comparator<ResolveInfo>() {
                    @Override
                    public int compare(ResolveInfo first, ResolveInfo second) {
                        String firstName = first.loadLabel(packageManager)
                                .toString();
                        String secondName = second.loadLabel(packageManager)
                                .toString();

                        return firstName.compareToIgnoreCase(secondName);
                    }
                }
        );

        Set<String> displayedPackages = new HashSet<>();
        int displayedCount = 0;

        for (ResolveInfo appInfo : installedApps) {
            String packageName = appInfo.activityInfo.packageName;

            if (packageName == null
                    || packageName.equals(getPackageName())
                    || packageName.equals(WHATSAPP)
                    || packageName.equals(YOUTUBE)
                    || displayedPackages.contains(packageName)) {
                continue;
            }

            displayedPackages.add(packageName);

            String appName = appInfo.loadLabel(packageManager).toString();

            boolean selectedByDefault =
                    packageName.equals(INSTAGRAM)
                    || packageName.equals(FACEBOOK);

            addApp(page, appName, packageName, selectedByDefault);
            displayedCount++;
        }

        if (displayedCount == 0) {
            addInfo(page, "No launchable apps were found.");
        } else {
            addInfo(
                    page,
                    displayedCount + " installed apps available for selection."
            );
        }
    }

    private void addHeading(LinearLayout page, String text) {
        TextView heading = new TextView(this);
        heading.setText(text);
        heading.setTextSize(18);
        heading.setTypeface(null, Typeface.BOLD);
        heading.setTextColor(darkGreen);
        heading.setPadding(0, 22, 0, 10);
        page.addView(heading);
    }

    private void addInfo(LinearLayout page, String text) {
        TextView info = new TextView(this);
        info.setText(text);
        info.setTextSize(15);
        info.setTextColor(textColor);
        info.setPadding(12, 7, 12, 7);
        page.addView(info);
    }

    private void addApp(
            LinearLayout page,
            String appName,
            String packageName,
            boolean selected
    ) {
        CheckBox checkBox = new CheckBox(this);
        checkBox.setText(appName);
        checkBox.setTextSize(16);
        checkBox.setTextColor(textColor);
        checkBox.setChecked(selected);
        checkBox.setTextColor(Color.rgb(236, 253, 245));
        checkBox.setPadding(16, 12, 16, 12);
        checkBox.setBackgroundResource(R.drawable.bg_emerald_card);
        checkBox.setElevation(3);
        checkBox.setTag(packageName);

        selectableApps.add(checkBox);
        page.addView(checkBox);
    }

    private org.json.JSONArray buildBlockedApps() {
        org.json.JSONArray apps = new org.json.JSONArray();

        for (CheckBox checkBox : selectableApps) {
            if (checkBox.isChecked()
                    && checkBox.getTag() instanceof String) {

                String packageName = (String) checkBox.getTag();

                if (!packageName.equals(WHATSAPP)
                        && !packageName.equals(YOUTUBE)
                        && !packageName.equals(getPackageName())) {
                    apps.put(packageName);
                }
            }
        }

        return apps;
    }

    private void toggleTimer() {
        if (running) {
            pauseTimer();
            return;
        }

        if (networkBusy) {
            return;
        }

        if (remainingMillis <= 0) {
            Toast.makeText(
                    this,
                    "Reset the timer to start again.",
                    Toast.LENGTH_SHORT
            ).show();
            return;
        }

        if (!hasAccessibilityConsent()) {
            showAccessibilityConsent();
            return;
        }

        if (!isAccessibilityServiceEnabled()) {
            new AlertDialog.Builder(this)
                    .setTitle("Enable app blocking")
                    .setMessage("Please enable CampusOS Focus Mode in Android Accessibility Settings.")
                    .setPositiveButton("Open Settings", (dialog, which) -> {
                        startActivity(
                                new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                        );
                    })
                    .setNegativeButton("Cancel", null)
                    .show();
            return;
        }

        if (deviceToken == null || deviceToken.isEmpty()) {
            Toast.makeText(
                    this,
                    "Please pair this device with CampusOS first.",
                    Toast.LENGTH_LONG
            ).show();

            pairingStatus.setText("Pair this device before starting a session.");
            return;
        }

        final long requestedDuration = remainingMillis;
        final int durationMinutes = Math.max(
                1,
                (int) Math.ceil(requestedDuration / 60000.0)
        );

        final String token = deviceToken;
        final org.json.JSONArray blockedApps = buildBlockedApps();

        networkBusy = true;
        startButton.setEnabled(false);
        statusText.setText("Synchronizing focus session with CampusOS...");

        networkExecutor.execute(() -> {
            try {
                JSONObject result = FocusApiClient.createSession(
                        token,
                        durationMinutes,
                        blockedApps
                );

                String sessionId = result.optString("sessionId", "");

                if (!result.optBoolean("success")
                        || !sessionId.matches("[a-zA-Z0-9]{10,40}")) {
                    throw new Exception("Invalid session response from CampusOS.");
                }

                mainHandler.post(() -> {
                    networkBusy = false;
                    startButton.setEnabled(true);

                    if (!hasAccessibilityConsent()) {
                        currentSessionId = null;
                        syncCloudSessionEnd(sessionId, "cancelled", 0);
                        statusText.setText("Session not started. Accessibility consent is required.");
                        return;
                    }

                    currentSessionId = sessionId;
                    currentSessionDurationMillis = requestedDuration;

                    startLocalTimer();
                });

            } catch (Exception error) {
                String message = error.getMessage();

                mainHandler.post(() -> {
                    networkBusy = false;
                    startButton.setEnabled(true);
                    statusText.setText("Cloud sync failed. Session not started.");

                    Toast.makeText(
                            MainActivity.this,
                            "Unable to start: "
                                    + (message == null ? "Please try again." : message),
                            Toast.LENGTH_LONG
                    ).show();
                });
            }
        });
    }

    private void startLocalTimer() {
        running = true;
        saveFocusSession(true);

        startButton.setText("Pause Focus Session");
        statusText.setText("Focus session active and synchronized.");

        countdown = new CountDownTimer(remainingMillis, 1000) {
            @Override
            public void onTick(long millisUntilFinished) {
                remainingMillis = millisUntilFinished;
                updateTimerText();
            }

            @Override
            public void onFinish() {
                remainingMillis = 0;
                running = false;

                saveFocusSession(false);
                updateTimerText();

                startButton.setText("Start Focus Session");
                statusText.setText("Focus session completed!");

                String finishedSessionId = currentSessionId;
                currentSessionId = null;

                if (finishedSessionId != null) {
                    syncCloudSessionEnd(
                            finishedSessionId,
                            "completed",
                            (int) (currentSessionDurationMillis / 1000L)
                    );
                }

                Toast.makeText(
                        MainActivity.this,
                        "Well done! Your focus session is complete.",
                        Toast.LENGTH_LONG
                ).show();
            }
        }.start();
    }

    private void syncCloudSessionEnd(
            String sessionId,
            String finalStatus,
            int elapsedSeconds
    ) {
        String token = deviceToken;

        if (token == null || token.isEmpty()) {
            return;
        }

        networkExecutor.execute(() -> {
            try {
                FocusApiClient.updateSession(
                        token,
                        sessionId,
                        finalStatus,
                        elapsedSeconds
                );
            } catch (Exception error) {
                String message = error.getMessage();

                mainHandler.post(() -> Toast.makeText(
                        MainActivity.this,
                        "Cloud history update failed: "
                                + (message == null ? "Please check your connection." : message),
                        Toast.LENGTH_LONG
                ).show());
            }
        });
    }

    private void pauseTimer() {
        if (!running) {
            return;
        }

        if (countdown != null) {
            countdown.cancel();
        }

        running = false;
        saveFocusSession(false);

        int elapsedSeconds = (int) Math.max(
                0,
                (currentSessionDurationMillis - remainingMillis) / 1000L
        );

        String pausedSessionId = currentSessionId;
        currentSessionId = null;

        if (pausedSessionId != null) {
            syncCloudSessionEnd(
                    pausedSessionId,
                    "paused",
                    elapsedSeconds
            );
        }

        startButton.setText("Resume Focus Session");
        statusText.setText("Session paused.");
    }

    private void resetTimer() {
        if (networkBusy) {
            Toast.makeText(
                    this,
                    "Please wait for CampusOS synchronization to finish.",
                    Toast.LENGTH_SHORT
            ).show();
            return;
        }

        if (countdown != null) {
            countdown.cancel();
        }

        if (running) {
            int elapsedSeconds = (int) Math.max(
                    0,
                    (currentSessionDurationMillis - remainingMillis) / 1000L
            );

            String cancelledSessionId = currentSessionId;
            currentSessionId = null;

            if (cancelledSessionId != null) {
                syncCloudSessionEnd(
                        cancelledSessionId,
                        "cancelled",
                        elapsedSeconds
                );
            }
        }

        running = false;
        saveFocusSession(false);

        int minutes = Integer.parseInt(
                durationSpinner.getSelectedItem().toString()
                        .replace(" minutes", "")
        );

        remainingMillis = minutes * 60 * 1000L;
        currentSessionDurationMillis = 0;

        startButton.setText("Start Focus Session");
        statusText.setText("Ready when you are.");
        updateTimerText();
    }

    private void updateTimerText() {
        long totalSeconds = remainingMillis / 1000;
        long minutes = totalSeconds / 60;
        long seconds = totalSeconds % 60;

        timerText.setText(
                String.format(
                        Locale.getDefault(),
                        "%02d:%02d",
                        minutes,
                        seconds
                )
        );
    }

    @Override
    protected void onDestroy() {
        if (countdown != null) {
            countdown.cancel();
        }
        super.onDestroy();
    }
}
