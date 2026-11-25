package com.campusos.focusmode;

import android.app.Activity;
import android.os.Bundle;
import android.os.CountDownTimer;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.View;
import android.content.Intent;
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

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

public class MainActivity extends Activity {

    private final int green = Color.rgb(5, 150, 105);
    private final int darkGreen = Color.rgb(6, 78, 59);
    private final int textColor = Color.rgb(30, 41, 59);

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

    private final ArrayList<CheckBox> selectableApps = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Color.rgb(236, 253, 245));

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

        addHeading(page, "Your focus session");

        timerText = new TextView(this);
        timerText.setText("25:00");
        timerText.setTextSize(48);
        timerText.setTypeface(null, Typeface.BOLD);
        timerText.setTextColor(darkGreen);
        timerText.setGravity(Gravity.CENTER);
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
        startButton.setBackgroundTintList(
                android.content.res.ColorStateList.valueOf(green)
        );

        LinearLayout.LayoutParams buttonParams =
                new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                );

        buttonParams.setMargins(0, 24, 0, 10);
        page.addView(startButton, buttonParams);

        Button resetButton = new Button(this);
        resetButton.setText("Reset Session");
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
        checkBox.setPadding(8, 5, 8, 5);
        checkBox.setTag(packageName);

        selectableApps.add(checkBox);
        page.addView(checkBox);
    }

    private void toggleTimer() {
        if (running) {
            pauseTimer();
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

        running = true;
        startButton.setText("Pause Focus Session");
        statusText.setText("Focus session in progress.");

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
                updateTimerText();
                startButton.setText("Start Focus Session");
                statusText.setText("Focus session completed!");

                Toast.makeText(
                        MainActivity.this,
                        "Well done! Your focus session is complete.",
                        Toast.LENGTH_LONG
                ).show();
            }
        }.start();
    }

    private void pauseTimer() {
        if (countdown != null) {
            countdown.cancel();
        }

        running = false;
        startButton.setText("Resume Focus Session");
        statusText.setText("Session paused.");
    }

    private void resetTimer() {
        if (countdown != null) {
            countdown.cancel();
        }

        running = false;

        int minutes = Integer.parseInt(
                durationSpinner.getSelectedItem().toString()
                        .replace(" minutes", "")
        );

        remainingMillis = minutes * 60 * 1000L;
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
