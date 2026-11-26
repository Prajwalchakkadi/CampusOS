package com.campusos.focusmode;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class FocusApiClient {

    // Local testing: Android app and Termux backend on the same phone.
    // Change this to your HTTPS backend URL before production deployment.
    private static final String BASE_URL =
            "http://127.0.0.1:5000";

    public static JSONObject request(
            String method,
            String endpoint,
            String token,
            JSONObject body
    ) throws Exception {

        URL url = new URL(BASE_URL + endpoint);

        HttpURLConnection connection =
                (HttpURLConnection) url.openConnection();

        connection.setRequestMethod(method);
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(15000);
        connection.setRequestProperty(
                "Accept",
                "application/json"
        );

        if (token != null && !token.isEmpty()) {
            connection.setRequestProperty(
                    "Authorization",
                    "Bearer " + token
            );
        }

        if (body != null) {
            connection.setDoOutput(true);
            connection.setRequestProperty(
                    "Content-Type",
                    "application/json; charset=UTF-8"
            );

            byte[] data = body.toString().getBytes(
                    StandardCharsets.UTF_8
            );

            try (OutputStream output = connection.getOutputStream()) {
                output.write(data);
            }
        }

        try {
            int status = connection.getResponseCode();

            InputStream stream = status >= 200 && status < 300
                    ? connection.getInputStream()
                    : connection.getErrorStream();

            StringBuilder response = new StringBuilder();

            if (stream != null) {
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(
                                stream,
                                StandardCharsets.UTF_8
                        )
                )) {
                    String line;

                    while ((line = reader.readLine()) != null) {
                        response.append(line);
                    }
                }
            }

            JSONObject result = response.length() == 0
                    ? new JSONObject()
                    : new JSONObject(response.toString());

            if (status < 200 || status >= 300) {
                String message = result.optString(
                        "message",
                        "Server returned HTTP " + status
                );

                throw new Exception(message);
            }

            return result;

        } finally {
            connection.disconnect();
        }
    }

    public static JSONObject exchangePairingCode(String code)
            throws Exception {

        JSONObject body = new JSONObject();
        body.put("code", code);

        return request(
                "POST",
                "/api/focus/pairing/exchange",
                null,
                body
        );
    }

    public static JSONObject createSession(
            String deviceToken,
            int durationMinutes,
            org.json.JSONArray blockedApps
    ) throws Exception {

        JSONObject body = new JSONObject();

        body.put("durationMinutes", durationMinutes);
        body.put("blockedApps", blockedApps);

        return request(
                "POST",
                "/api/focus/sessions",
                deviceToken,
                body
        );
    }

    public static JSONObject updateSession(
            String deviceToken,
            String sessionId,
            String status,
            int elapsedSeconds
    ) throws Exception {

        JSONObject body = new JSONObject();

        body.put("status", status);
        body.put("elapsedSeconds", elapsedSeconds);

        return request(
                "PATCH",
                "/api/focus/sessions/" + sessionId,
                deviceToken,
                body
        );
    }
}
