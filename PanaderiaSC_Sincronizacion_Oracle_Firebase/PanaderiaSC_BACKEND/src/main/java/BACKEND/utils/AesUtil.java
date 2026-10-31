package BACKEND.utils;


import java.io.UnsupportedEncodingException;
import java.security.InvalidAlgorithmParameterException;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;

import java.security.spec.InvalidKeySpecException;
import java.security.spec.KeySpec;

import javax.crypto.BadPaddingException;
import javax.crypto.Cipher;
import javax.crypto.IllegalBlockSizeException;
import javax.crypto.NoSuchPaddingException;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;



import BACKEND.utils.Hash;

// TODO: Implement 256-bit version like: http://securejava.wordpress.com/2012/10/25/aes-256/
public class AesUtil {
    private final int keySize=256;
  //  private final int iterationCount=1;
    private  Cipher cipher;
    
  //  private  String salt="3FF2EC019C627B945225DEBAD71A01B6985FE84C95A70EB132882F88C0A59A55";
  //  private  String iv="F27D5C9927726BCEFE7510B1BDD3D137";
    

    
    public AesUtil() {
        
        try {
            cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
        }
        catch (NoSuchAlgorithmException | NoSuchPaddingException e) {
            throw fail(e);
        }
    }
    

    
    public String encrypt(String passphrase, String plaintext) {
        try {
        	String iv=Hash.MD5(passphrase);
        	
            /*System.out.println("plaintext:"+plaintext);
        	System.out.println("passphrase:"+passphrase);
        	System.out.println("iv:"+iv);*/
        	
            SecretKey key = generateKey(passphrase);
            byte[] encrypted = doFinal(Cipher.ENCRYPT_MODE, key, iv, plaintext.getBytes("UTF-8"));
            return Hash.base64(encrypted);
        }
        catch (UnsupportedEncodingException e) {
            throw fail(e);
        }
    }
    
    public String decrypt(String passphrase, String ciphertext) {
        try {
        	
        	String iv=Hash.MD5(passphrase);
        	
            SecretKey key = generateKey(passphrase);
            byte[] decrypted = doFinal(Cipher.DECRYPT_MODE, key, iv, Hash.base64(ciphertext));
            return new String(decrypted, "UTF-8");
        }
        catch (UnsupportedEncodingException e) {
            throw fail(e);
        }
    }
    
    private byte[] doFinal(int encryptMode, SecretKey key, String iv, byte[] bytes) {
        try {
            cipher.init(encryptMode, key, new IvParameterSpec(Hash.hex(iv)));
            return cipher.doFinal(bytes);
        }
        catch (InvalidKeyException
                | InvalidAlgorithmParameterException
                | IllegalBlockSizeException
                | BadPaddingException e) {
            throw fail(e);
        }
    }
    
    private SecretKey generateKey(String passphrase) {
        try {
        	int iterationCount=passphrase.length();
        	String hashphrase=Hash.SHA1(passphrase);
        	String salt=Hash.SHA256(passphrase);
        	
        	/*System.out.println("iterationCount:"+iterationCount);
        	System.out.println("hashphrase:"+hashphrase);
        	System.out.println("salt:"+salt);*/

            SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA1");
            KeySpec spec = new PBEKeySpec(hashphrase.toCharArray(), Hash.hex(salt), iterationCount, keySize);
            SecretKey key = new SecretKeySpec(factory.generateSecret(spec).getEncoded(), "AES");
            return key;
        }
        catch (NoSuchAlgorithmException | InvalidKeySpecException e) {
            throw fail(e);
        }
    }
    
    
    
    
    
    private IllegalStateException fail(Exception e) {
        return new IllegalStateException(e);
    }
}
