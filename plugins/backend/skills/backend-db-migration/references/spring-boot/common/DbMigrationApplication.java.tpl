package {{basePackage}}.db.migration;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;

/**
 * Job migration chạy độc lập, KHÔNG phải service HTTP: schema phải sẵn sàng TRƯỚC khi app chính
 * lên, và người vận hành cần điều khiển được thời điểm chạy (ADR — mô hình module job riêng).
 */
@SpringBootApplication
public class DbMigrationApplication {

    public static void main(String[] args) {
        int exitCode = SpringApplication.exit(
                new SpringApplicationBuilder(DbMigrationApplication.class)
                        .web(WebApplicationType.NONE)
                        .run(args));
        System.exit(exitCode);
    }
}
