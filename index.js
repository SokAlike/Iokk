import java.io.*;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.*;

public class Main {
    static final Properties cfg = new Properties();
    static double d(String k) { return Double.parseDouble(cfg.getProperty(k)); }
    static int i(String k) { return Integer.parseInt(cfg.getProperty(k)); }

    static BrokerConnector broker() {
        return cfg.getProperty("broker").equalsIgnoreCase("quotex") ? new QuotexBroker()
            : new MockBroker(d("startBalance"), d("payout"), (long) d("candleDelayMs"));
    }

    public static void main(String[] args) throws Exception {
        try (InputStream in = new FileInputStream("config.properties")) { cfg.load(in); }
        catch (IOException e) { System.out.println("config.properties not found, using defaults."); setDefaults(); }
        Scanner sc = new Scanner(System.in);
        while (true) {
            System.out.printf("%n=== Trading Bot === broker=%s asset=%s strategy=%s stake=%s%n",
                cfg.getProperty("broker"), cfg.getProperty("asset"), Strategy.of(cfg.getProperty("strategy")).name(), cfg.getProperty("stake"));
            System.out.println("1) Backtest (simulated data)\n2) Backtest (CSV file)\n3) Run bot\n4) Change strategy\n5) Change stake\n6) Change asset\n0) Exit");
            System.out.print("> ");
            if (!sc.hasNextLine()) return;
            String c = sc.nextLine().trim();
            try {
                switch (c) {
                    case "1" -> {
                        MockBroker m = new MockBroker(0, d("payout"), 0); m.connect();
                        for (int k = 0; k < 3000; k++) m.waitForNextCandle();
                        Backtester.run(m.getCandles("x", 3300), Strategy.of(cfg.getProperty("strategy")), d("stake"), d("payout"));
                    }
                    case "2" -> {
                        System.out.print("CSV path: ");
                        Backtester.run(Backtester.loadCsv(sc.nextLine().trim()), Strategy.of(cfg.getProperty("strategy")), d("stake"), d("payout"));
                    }
                    case "3" -> live();
                    case "4" -> { System.out.print("ema / rsi / bollinger: "); cfg.setProperty("strategy", sc.nextLine().trim()); }
                    case "5" -> { System.out.print("Stake: "); cfg.setProperty("stake", String.valueOf(Double.parseDouble(sc.nextLine().trim()))); }
                    case "6" -> { System.out.print("Asset: "); cfg.setProperty("asset", sc.nextLine().trim()); }
                    case "0" -> { return; }
                    default -> System.out.println("Unknown option.");
                }
            } catch (Exception e) { System.out.println("Error: " + e.getMessage()); }
        }
    }

    static void live() throws Exception {
        BrokerConnector b = broker(); b.connect();
        Strategy s = Strategy.of(cfg.getProperty("strategy"));
        RiskManager rm = new RiskManager(d("maxDailyLoss"), d("maxDailyProfit"), i("maxConsecutiveLosses"));
        TradeLogger log = new TradeLogger(cfg.getProperty("logFile"));
        String asset = cfg.getProperty("asset");
        int trades = 0, wins = 0, guard = 0;
        System.out.println("Running " + s.name() + " on " + asset + " ...");
        while (trades < i("maxTrades") && rm.canTrade() && guard++ < 20000) {
            Signal sig = s.analyze(b.getCandles(asset, 200));
            if (sig != Signal.NONE) {
                TradeResult r = b.placeTrade(asset, sig, d("stake"), i("expirySeconds"));
                rm.record(r); trades++; if (r.profit() > 0) wins++;
                log.log(asset, r, b.getBalance());
                System.out.printf("#%d %s %.2f -> %s  profit %+.2f  balance %.2f%n", trades, sig, r.amount(),
                    r.profit() > 0 ? "WIN" : r.profit() < 0 ? "LOSS" : "TIE", r.profit(), b.getBalance());
            }
            b.waitForNextCandle();
        }
        System.out.printf("Stopped: %s. Trades %d, wins %d, session P/L %+.2f, balance %.2f. Log: %s%n",
            rm.canTrade() ? "trade limit reached" : rm.reason(), trades, wins, rm.pnl(), b.getBalance(), cfg.getProperty("logFile"));
    }

    static void setDefaults() {
        String[] kv = {"broker","mock","asset","EURUSD_otc","strategy","ema","stake","10","expirySeconds","60","payout","0.85",
            "startBalance","1000","maxTrades","30","maxDailyLoss","100","maxDailyProfit","150","maxConsecutiveLosses","4",
            "candleDelayMs","0","logFile","trades.csv"};
        for (int k = 0; k < kv.length; k += 2) cfg.setProperty(kv[k], kv[k + 1]);
    }
}

enum Signal { CALL, PUT, NONE }

record Candle(long time, double open, double high, double low, double close) {}

record TradeResult(Signal dir, double amount, double entry, double exit, double profit, boolean win) {}

/** Plug any broker here. MockBroker works offline; QuotexBroker is a stub to implement. */
interface BrokerConnector {
    void connect() throws Exception;
    double getBalance();
    List<Candle> getCandles(String asset, int count);
    TradeResult placeTrade(String asset, Signal dir, double amount, int expirySec);
    void waitForNextCandle();
}

/**
 * STUB. Quotex has no official API. Implement this with an unofficial client
 * (login + WebSocket) at your own risk, then set broker=quotex.
 * Use the DEMO account first.
 */
class QuotexBroker implements BrokerConnector {
    private UnsupportedOperationException na() {
        return new UnsupportedOperationException("QuotexBroker not implemented: no official API. Fill in connect/getCandles/placeTrade.");
    }
    public void connect() { throw na(); }
    public double getBalance() { throw na(); }
    public List<Candle> getCandles(String asset, int count) { throw na(); }
    public TradeResult placeTrade(String asset, Signal dir, double amount, int expirySec) { throw na(); }
    public void waitForNextCandle() { throw na(); }
}

/** Simulated market (random walk) with a paper balance. */
class MockBroker implements BrokerConnector {
    private final List<Candle> candles = new ArrayList<>();
    private final Random rnd = new Random();
    private final double payout, startBalance;
    private final long delayMs;
    private double balance;
    private double price = 1.1000;
    private long t = System.currentTimeMillis() / 1000 - 300 * 60;

    public MockBroker(double startBalance, double payout, long delayMs) {
        this.startBalance = startBalance; this.balance = startBalance;
        this.payout = payout; this.delayMs = delayMs;
    }
    private void step() {
        double open = price;
        double drift = Math.sin(t / 900.0) * 0.00004;          // slow wave so trends exist
        price = open + drift + rnd.nextGaussian() * 0.00025;
        double hi = Math.max(open, price) + Math.abs(rnd.nextGaussian()) * 0.0001;
        double lo = Math.min(open, price) - Math.abs(rnd.nextGaussian()) * 0.0001;
        candles.add(new Candle(t, open, hi, lo, price));
        t += 60;
    }
    public void connect() { for (int i = 0; i < 300; i++) step(); System.out.println("[Mock] connected, paper balance " + balance); }
    public double getBalance() { return balance; }
    public List<Candle> getCandles(String asset, int count) {
        return new ArrayList<>(candles.subList(Math.max(0, candles.size() - count), candles.size()));
    }
    public TradeResult placeTrade(String asset, Signal dir, double amount, int expirySec) {
        double entry = price;
        for (int i = 0; i < Math.max(1, expirySec / 60); i++) step();
        double exit = price;
        boolean win = (dir == Signal.CALL && exit > entry) || (dir == Signal.PUT && exit < entry);
        boolean tie = exit == entry;
        double profit = tie ? 0 : win ? amount * payout : -amount;
        balance += profit;
        return new TradeResult(dir, amount, entry, exit, profit, win);
    }
    public void waitForNextCandle() {
        step();
        if (delayMs > 0) try { Thread.sleep(delayMs); } catch (InterruptedException ignored) {}
    }
}

final class Indicators {
    private Indicators() {}
    public static double[] closes(List<Candle> c) { return c.stream().mapToDouble(Candle::close).toArray(); }

    public static double[] ema(double[] v, int p) {
        double[] out = new double[v.length]; double k = 2.0 / (p + 1);
        if (v.length == 0) return out;
        out[0] = v[0];
        for (int i = 1; i < v.length; i++) out[i] = v[i] * k + out[i - 1] * (1 - k);
        return out;
    }
    public static double sma(double[] v, int p) {
        double s = 0; for (int i = v.length - p; i < v.length; i++) s += v[i]; return s / p;
    }
    /** Wilder RSI of the last value. */
    public static double rsi(double[] v, int p) {
        if (v.length <= p) return 50;
        double g = 0, l = 0;
        for (int i = 1; i <= p; i++) { double d = v[i] - v[i - 1]; if (d > 0) g += d; else l -= d; }
        g /= p; l /= p;
        for (int i = p + 1; i < v.length; i++) {
            double d = v[i] - v[i - 1];
            g = (g * (p - 1) + Math.max(d, 0)) / p;
            l = (l * (p - 1) + Math.max(-d, 0)) / p;
        }
        return l == 0 ? 100 : 100 - 100 / (1 + g / l);
    }
    /** returns {lower, middle, upper} */
    public static double[] bollinger(double[] v, int p, double mult) {
        double m = sma(v, p), s = 0;
        for (int i = v.length - p; i < v.length; i++) s += (v[i] - m) * (v[i] - m);
        double sd = Math.sqrt(s / p);
        return new double[]{m - mult * sd, m, m + mult * sd};
    }
}

interface Strategy {
    String name();
    Signal analyze(List<Candle> candles);

    static Strategy of(String key) {
        return switch (key.toLowerCase()) {
            case "rsi" -> new Rsi(14, 30, 70);
            case "bollinger" -> new Bollinger(20, 2.0);
            default -> new EmaCross(9, 21);
        };
    }

    record EmaCross(int fast, int slow) implements Strategy {
        public String name() { return "EMA crossover " + fast + "/" + slow; }
        public Signal analyze(List<Candle> c) {
            if (c.size() < slow + 3) return Signal.NONE;
            double[] cl = Indicators.closes(c);
            double[] f = Indicators.ema(cl, fast), s = Indicators.ema(cl, slow);
            int n = cl.length;
            double prev = f[n - 2] - s[n - 2], cur = f[n - 1] - s[n - 1];
            if (prev <= 0 && cur > 0) return Signal.CALL;
            if (prev >= 0 && cur < 0) return Signal.PUT;
            return Signal.NONE;
        }
    }
    record Rsi(int period, double low, double high) implements Strategy {
        public String name() { return "RSI " + period + " (" + low + "/" + high + ")"; }
        public Signal analyze(List<Candle> c) {
            if (c.size() < period + 3) return Signal.NONE;
            double r = Indicators.rsi(Indicators.closes(c), period);
            if (r < low) return Signal.CALL;
            if (r > high) return Signal.PUT;
            return Signal.NONE;
        }
    }
    record Bollinger(int period, double mult) implements Strategy {
        public String name() { return "Bollinger " + period + "," + mult; }
        public Signal analyze(List<Candle> c) {
            if (c.size() < period + 2) return Signal.NONE;
            double[] cl = Indicators.closes(c);
            double[] b = Indicators.bollinger(cl, period, mult);
            double last = cl[cl.length - 1];
            if (last < b[0]) return Signal.CALL;
            if (last > b[2]) return Signal.PUT;
            return Signal.NONE;
        }
    }
}

class RiskManager {
    private final double maxLoss, maxProfit; private final int maxConsec;
    private double pnl; private int consec; private String reason = "";
    public RiskManager(double maxLoss, double maxProfit, int maxConsec) {
        this.maxLoss = maxLoss; this.maxProfit = maxProfit; this.maxConsec = maxConsec;
    }
    public void record(TradeResult r) {
        pnl += r.profit();
        consec = r.profit() < 0 ? consec + 1 : r.profit() > 0 ? 0 : consec;
    }
    public boolean canTrade() {
        if (pnl <= -maxLoss) { reason = "max daily loss reached"; return false; }
        if (pnl >= maxProfit) { reason = "daily profit target reached"; return false; }
        if (consec >= maxConsec) { reason = "max consecutive losses reached"; return false; }
        return true;
    }
    public String reason() { return reason; }
    public double pnl() { return pnl; }
}

class TradeLogger {
    private final String file;
    public TradeLogger(String file) {
        this.file = file;
        if (!new File(file).exists()) write("time,asset,direction,amount,entry,exit,result,profit,balance");
    }
    public void log(String asset, TradeResult r, double balance) {
        write(String.format("%s,%s,%s,%.2f,%.5f,%.5f,%s,%.2f,%.2f", LocalDateTime.now(), asset, r.dir(),
            r.amount(), r.entry(), r.exit(), r.profit() > 0 ? "WIN" : r.profit() < 0 ? "LOSS" : "TIE", r.profit(), balance));
    }
    private void write(String line) {
        try (PrintWriter w = new PrintWriter(new FileWriter(file, true))) { w.println(line); }
        catch (IOException e) { System.out.println("Log error: " + e.getMessage()); }
    }
}

class Backtester {
    /** CSV columns: time,open,high,low,close (header optional). */
    public static List<Candle> loadCsv(String path) throws IOException {
        List<Candle> out = new ArrayList<>();
        for (String line : Files.readAllLines(Path.of(path))) {
            String[] p = line.trim().split(",");
            if (p.length < 5) continue;
            try {
                out.add(new Candle((long) Double.parseDouble(p[0]), Double.parseDouble(p[1]),
                    Double.parseDouble(p[2]), Double.parseDouble(p[3]), Double.parseDouble(p[4])));
            } catch (NumberFormatException ignored) {} // header row
        }
        return out;
    }
    /** Trade opens at close of candle i, expires at close of candle i+1. */
    public static void run(List<Candle> data, Strategy s, double stake, double payout) {
        int wins = 0, losses = 0, ties = 0; double profit = 0, peak = 0, maxDd = 0;
        for (int i = 30; i < data.size() - 1; i++) {
            Signal sig = s.analyze(data.subList(0, i + 1));
            if (sig == Signal.NONE) continue;
            double a = data.get(i).close(), b = data.get(i + 1).close();
            if (a == b) { ties++; continue; }
            boolean win = (sig == Signal.CALL) == (b > a);
            if (win) { wins++; profit += stake * payout; } else { losses++; profit -= stake; }
            peak = Math.max(peak, profit); maxDd = Math.max(maxDd, peak - profit);
        }
        int n = wins + losses;
        System.out.println("\n--- Backtest: " + s.name() + " ---");
        System.out.printf("Candles: %d | Trades: %d | Wins: %d | Losses: %d | Ties: %d%n", data.size(), n, wins, losses, ties);
        System.out.printf("Win rate: %.1f%% (break-even at payout %.0f%%: %.1f%%)%n",
            n == 0 ? 0 : 100.0 * wins / n, payout * 100, 100 / (1 + payout));
        System.out.printf("Net profit: %.2f | Max drawdown: %.2f%n", profit, maxDd);
    }
}
