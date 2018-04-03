--
-- PostgreSQL database dump
--

-- Dumped from database version 9.5.12
-- Dumped by pg_dump version 9.5.12

-- Started on 2018-04-03 17:53:52 EEST

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 1 (class 3079 OID 12395)
-- Name: plpgsql; Type: EXTENSION; Schema: -; Owner: 
--

CREATE EXTENSION IF NOT EXISTS plpgsql WITH SCHEMA pg_catalog;


--
-- TOC entry 2161 (class 0 OID 0)
-- Dependencies: 1
-- Name: EXTENSION plpgsql; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION plpgsql IS 'PL/pgSQL procedural language';


SET default_tablespace = '';

SET default_with_oids = false;

--
-- TOC entry 183 (class 1259 OID 16411)
-- Name: oblasti; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.oblasti (
    id character varying NOT NULL,
    name character varying,
    municipality_id character varying
);


ALTER TABLE public.oblasti OWNER TO postgres;

--
-- TOC entry 182 (class 1259 OID 16398)
-- Name: obshtini; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.obshtini (
    id character varying NOT NULL,
    name character varying,
    town_id integer
);


ALTER TABLE public.obshtini OWNER TO postgres;

--
-- TOC entry 181 (class 1259 OID 16390)
-- Name: selishta; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.selishta (
    id integer NOT NULL,
    name character varying
);


ALTER TABLE public.selishta OWNER TO postgres;

--
-- TOC entry 2152 (class 0 OID 16411)
-- Dependencies: 183
-- Data for Name: oblasti; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.oblasti (id, name, municipality_id) FROM stdin;
\.


--
-- TOC entry 2151 (class 0 OID 16398)
-- Dependencies: 182
-- Data for Name: obshtini; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.obshtini (id, name, town_id) FROM stdin;
\.


--
-- TOC entry 2150 (class 0 OID 16390)
-- Dependencies: 181
-- Data for Name: selishta; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.selishta (id, name) FROM stdin;
\.


--
-- TOC entry 2033 (class 2606 OID 16418)
-- Name: oblasti_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.oblasti
    ADD CONSTRAINT oblasti_pkey PRIMARY KEY (id);


--
-- TOC entry 2031 (class 2606 OID 16405)
-- Name: obshtini_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.obshtini
    ADD CONSTRAINT obshtini_pkey PRIMARY KEY (id);


--
-- TOC entry 2029 (class 2606 OID 16397)
-- Name: selishta_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.selishta
    ADD CONSTRAINT selishta_pkey PRIMARY KEY (id);


--
-- TOC entry 2035 (class 2606 OID 16419)
-- Name: oblasti_municipality_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.oblasti
    ADD CONSTRAINT oblasti_municipality_id_fkey FOREIGN KEY (municipality_id) REFERENCES public.obshtini(id);


--
-- TOC entry 2034 (class 2606 OID 16406)
-- Name: obshtini_town_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.obshtini
    ADD CONSTRAINT obshtini_town_id_fkey FOREIGN KEY (town_id) REFERENCES public.selishta(id);


--
-- TOC entry 2160 (class 0 OID 0)
-- Dependencies: 6
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM postgres;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO PUBLIC;


-- Completed on 2018-04-03 17:53:52 EEST

--
-- PostgreSQL database dump complete
--

