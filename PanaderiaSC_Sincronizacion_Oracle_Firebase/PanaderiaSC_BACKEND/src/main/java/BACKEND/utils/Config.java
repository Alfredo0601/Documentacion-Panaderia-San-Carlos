package BACKEND.utils;

import org.apache.commons.configuration2.XMLConfiguration;
import org.apache.commons.configuration2.builder.fluent.Configurations;
import org.apache.commons.configuration2.ex.ConfigurationException;

public final class Config {
	Configurations configs ;
	XMLConfiguration config;
	public Config(){
		 this.configs = new Configurations();
		try {
			this.config = configs.xml("config.xml");
		} catch (ConfigurationException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
		
	}
	public String getDBHost(){
		return this.config.getString("db.host");
	}
	public String getDBPort(){
		return this.config.getString("db.port");
	}
	public String getDBService(){
		return this.config.getString("db.service");
	}
	public String getDBUser(){
		return this.config.getString("db.user");
	}
	public String getDBPass(){
		return this.config.getString("db.pass");
	}
	public String getDBSchema(){
		return this.config.getString("db.schema");
	}
        public String getSistemaNombre(){
		return this.config.getString("sistema.nombre");
	}
        
}
