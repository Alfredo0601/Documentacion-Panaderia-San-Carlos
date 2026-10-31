/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 *
**
 *
 * @author jscastillo
 */

/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package BACKEND.utils;

/**
 *
 * @author jscastillo
 '********************************* IMPORTANTE ************************************************************
    'Esta clase tiene como objetivo proveer de un metodo para encriptar y desincriptar
    'las dos cadenas 
    ' :: patron_busqueda  
    ' :: Patron_encripta 
    'son necesarias para realizar dichos proceso y 
    'NO DEBEN MODIFICARSE bajo ningun motivo 
    'Private patron_busqueda As String = "OS3HugYLX5cP0w97n8doQ41eAkRbhxZJjpsfE6lñ-VDvFMmCNyiGKÑ2zUrItTaqWB"
    'Private Patron_encripta As String = "hxbp3c57M4A6Hv9elkrGRaYnX-ImOqwdT1UEDPjsñÑWiJZ28QS0NufgFzyCBVLotK"
    '*********************************************************************************************************

    'NO MODIFICAR ESTAS CADENAS
*/
public class Encripter {
 
   private static final String Patron_busqueda = "OS3HugYLX5cP0w97n8doQ41eAkRbhxZJjpsfE6lñ-VDvFMmCNyiGKÑ2zUrItTaqWB";
   private static final String Patron_encripta = "hxbp3c57M4A6Hv9elkrGRaYnX-ImOqwdT1UEDPjsñÑWiJZ28QS0NufgFzyCBVLotK";

   
   public static   String  EncriptarCadena( String cadena){
    int idx;
    String result =" ";
    
    for ( idx=0; idx<cadena.length(); idx++)
    {
     result +=  EncriptarCaracter(cadena.substring(idx, idx+ 1), cadena.length(), idx); 
    }
    return result;
    
    }
     public static String EncriptarCaracter(String caracter, int variable ,int a_indice)
    
   // private static  String EncriptarCaracter(String caracter, int variable ,int a_indice)
    {
    
    int indice;
  
    if (Patron_busqueda.contains(caracter))
        {
         indice = (Patron_busqueda.indexOf(caracter) + variable + a_indice)   %  Patron_busqueda.length();
         return Patron_encripta.substring(indice, indice +1);    
        }
    return caracter;
    }
    
    //DESENCRIPTAR '''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''
    public static   String DesEncriptarCadena(String cadena )
    {
    int idx;
    String result ="";
    for ( idx=0; idx<cadena.length(); idx++)
    {
     result +=  DesEncriptarCaracter(cadena.substring(idx,idx+ 1), cadena.length(), idx); 
    }
    
    return result;
    }
   public static  String DesEncriptarCaracter(String caracter , int variable ,int a_indice)
 
 //   private static  String DesEncriptarCaracter(String caracter , int variable ,int a_indice)
    {
    int indice ;
    
        if (Patron_encripta.contains(caracter))
        {
          if ((Patron_encripta.indexOf(caracter)- variable - a_indice) > 0 )
          {
           indice = (Patron_encripta.indexOf(caracter)- variable - a_indice) % Patron_encripta.length();
          }
          else
          {
              indice = (Patron_busqueda.length()) + ((Patron_encripta.indexOf(caracter) - variable - a_indice) % Patron_encripta.length());
          }
          indice = indice % Patron_encripta.length();
          return Patron_busqueda.substring(indice, indice + 1);
     
        }
        else
        {
        return caracter;
        }
    }

    
    
}
