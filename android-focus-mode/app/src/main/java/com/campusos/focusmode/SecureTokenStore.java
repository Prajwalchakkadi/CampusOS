package com.campusos.focusmode;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public class SecureTokenStore {

    private static final String ALIAS = "CampusOSFocusDeviceKey";
    private static final String PREFS = "focus_secure";
    private static final String IV_KEY = "token_iv";
    private static final String DATA_KEY = "token_data";

    private static SecretKey getSecretKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);

        if (keyStore.containsAlias(ALIAS)) {
            return (SecretKey) keyStore.getKey(ALIAS, null);
        }

        KeyGenerator generator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES,
                "AndroidKeyStore"
        );

        generator.init(
                new KeyGenParameterSpec.Builder(
                        ALIAS,
                        KeyProperties.PURPOSE_ENCRYPT |
                                KeyProperties.PURPOSE_DECRYPT
                )
                        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                        .setEncryptionPaddings(
                                KeyProperties.ENCRYPTION_PADDING_NONE
                        )
                        .setRandomizedEncryptionRequired(true)
                        .build()
        );

        return generator.generateKey();
    }

    public static void save(Context context, String token)
            throws Exception {

        if (token == null || !token.matches("[a-fA-F0-9]{64}")) {
            throw new IllegalArgumentException("Invalid device token.");
        }

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");

        cipher.init(Cipher.ENCRYPT_MODE, getSecretKey());

        byte[] encrypted = cipher.doFinal(
                token.getBytes("UTF-8")
        );

        SharedPreferences prefs =
                context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);

        prefs.edit()
                .putString(
                        IV_KEY,
                        Base64.encodeToString(
                                cipher.getIV(),
                                Base64.NO_WRAP
                        )
                )
                .putString(
                        DATA_KEY,
                        Base64.encodeToString(
                                encrypted,
                                Base64.NO_WRAP
                        )
                )
                .apply();
    }

    public static String read(Context context) throws Exception {

        SharedPreferences prefs =
                context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);

        String ivText = prefs.getString(IV_KEY, null);
        String dataText = prefs.getString(DATA_KEY, null);

        if (ivText == null || dataText == null) {
            return null;
        }

        byte[] iv = Base64.decode(ivText, Base64.NO_WRAP);
        byte[] encrypted = Base64.decode(dataText, Base64.NO_WRAP);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");

        cipher.init(
                Cipher.DECRYPT_MODE,
                getSecretKey(),
                new GCMParameterSpec(128, iv)
        );

        String token = new String(
                cipher.doFinal(encrypted),
                "UTF-8"
        );

        if (!token.matches("[a-fA-F0-9]{64}")) {
            throw new SecurityException("Stored credential is invalid.");
        }

        return token;
    }

    public static void clear(Context context) {

        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .clear()
                .apply();
    }
}
