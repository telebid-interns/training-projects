import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        String[] nm = scanner.nextLine().split(" ");
        int cities = Integer.parseInt(nm[0]);
        int roads = Integer.parseInt(nm[1]);

        if(cities<2 || cities>1000 || roads<1 || roads>10000){
            System.out.println("error");
        }else{
            for (int i = 0; i < roads; i++) {
                String[] tokens = scanner.nextLine().split(" ");
                int from = Integer.parseInt(tokens[0]);
                int to = Integer.parseInt(tokens[1]);
                int speed = Integer.parseInt(tokens[2]);
                if(from < 1 || from > cities || to < 1 || to>cities || speed < 1 || speed > 30000){
                    System.out.println("error");
                    break;
                }
            }
        }

    }
}
