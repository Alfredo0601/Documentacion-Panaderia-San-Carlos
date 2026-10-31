package BACKEND.utils;

public class jsonResult {
	public int id;
	public String result;
	public String msj;
	public String detail;
	
	public jsonResult(){
		super();
		this.id = -1;
		this.result = "ERROR";
	}
	
	public jsonResult(int id, String result, String msj, String detail) {
		super();
		this.id = id;
		this.result = result;
		this.msj = msj;
		this.detail=detail;
	}
	public jsonResult(int id, String result, String msj) {
		super();
		this.id = id;
		this.result = result;
		this.msj = msj;
	}
	
	
	
	
	
}
